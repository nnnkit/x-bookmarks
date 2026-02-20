import { describe, it, expect } from "vitest";
import type { Bookmark } from "../../types";
import type { BookmarkPageResult } from "../../api/parsers";
import { reconcileBookmarks } from "../reconcile";

function makeBookmark(tweetId: string): Bookmark {
  return {
    id: tweetId,
    tweetId,
    text: "",
    createdAt: 0,
    sortIndex: tweetId,
    author: { name: "", screenName: "", profileImageUrl: "", verified: false },
    metrics: { likes: 0, retweets: 0, replies: 0, views: 0, bookmarks: 0 },
    media: [],
    urls: [],
    isThread: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    quotedTweet: null,
  };
}

function makePaginatedFetcher(
  pages: Bookmark[][],
): (cursor?: string) => Promise<BookmarkPageResult> {
  let callCount = 0;
  return async (cursor?: string) => {
    const pageIndex = cursor ? parseInt(cursor, 10) : 0;
    const bookmarks = pages[pageIndex] ?? [];
    callCount++;
    const nextIndex = pageIndex + 1;
    return {
      bookmarks,
      cursor: nextIndex < pages.length ? String(nextIndex) : null,
    };
  };
}

describe("reconcileBookmarks", () => {
  describe("correctness", () => {
    it("incremental sync stops at first page with all-known bookmarks", async () => {
      const local = [makeBookmark("1"), makeBookmark("2")];
      const localIds = new Set(local.map((b) => b.tweetId));

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
        [makeBookmark("3")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: false,
      });

      expect(result.newBookmarks).toHaveLength(0);
      expect(result.pagesRequested).toBe(1);
    });

    it("incremental sync collects new bookmarks across multiple pages", async () => {
      const localIds = new Set(["1"]);

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("2"), makeBookmark("1")],
        [makeBookmark("3")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: false,
      });

      expect(result.newBookmarks.map((b) => b.tweetId)).toEqual(["2", "3"]);
      expect(result.pagesRequested).toBe(2);
    });

    it("full reconcile identifies stale local bookmarks not present remotely", async () => {
      const localIds = new Set(["1", "2", "stale"]);

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });

      expect(result.staleIds).toEqual(["stale"]);
      expect(result.newBookmarks).toHaveLength(0);
    });

    it("full reconcile pages through ALL results even when no new bookmarks on a page", async () => {
      const localIds = new Set(["1", "2", "3"]);

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1")],
        [makeBookmark("2")],
        [makeBookmark("3")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });

      expect(result.pagesRequested).toBe(3);
      expect(result.staleIds).toHaveLength(0);
    });

    it("full reconcile handles mixed new + existing bookmarks", async () => {
      const localIds = new Set(["1", "stale1", "stale2"]);

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
        [makeBookmark("3")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });

      expect(result.newBookmarks.map((b) => b.tweetId)).toEqual(["2", "3"]);
      expect(result.staleIds.sort()).toEqual(["stale1", "stale2"]);
    });

    it("empty remote marks all local bookmarks as stale", async () => {
      const localIds = new Set(["1", "2"]);

      const fetchPage = makePaginatedFetcher([[]]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });

      expect(result.newBookmarks).toHaveLength(0);
      expect(result.staleIds.sort()).toEqual(["1", "2"]);
    });

    it("empty local reports all remote bookmarks as new", async () => {
      const localIds = new Set<string>();

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: false,
      });

      expect(result.newBookmarks.map((b) => b.tweetId)).toEqual(["1", "2"]);
      expect(result.staleIds).toHaveLength(0);
    });

    it("perfect match produces no new bookmarks and no stale IDs", async () => {
      const localIds = new Set(["1", "2"]);

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });

      expect(result.newBookmarks).toHaveLength(0);
      expect(result.staleIds).toHaveLength(0);
    });
  });

  describe("efficiency", () => {
    it("incremental sync makes 1 API call when first page has no new bookmarks", async () => {
      const localIds = new Set(["1", "2"]);

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
        [makeBookmark("3")],
      ]);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: false,
      });

      expect(result.pagesRequested).toBe(1);
    });

    it("full reconcile with N bookmarks at P per page = ceil(N/P) fetches", async () => {
      const totalBookmarks = 10;
      const pageSize = 3;
      const allBookmarks = Array.from({ length: totalBookmarks }, (_, i) =>
        makeBookmark(String(i)),
      );
      const localIds = new Set(allBookmarks.map((b) => b.tweetId));

      const pages: Bookmark[][] = [];
      for (let i = 0; i < allBookmarks.length; i += pageSize) {
        pages.push(allBookmarks.slice(i, i + pageSize));
      }

      const fetchPage = makePaginatedFetcher(pages);

      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });

      expect(result.pagesRequested).toBe(Math.ceil(totalBookmarks / pageSize));
    });

    it("reconcile 10,000 bookmarks completes under 50ms", async () => {
      const count = 10_000;
      const allBookmarks = Array.from({ length: count }, (_, i) =>
        makeBookmark(String(i)),
      );
      const localIds = new Set(
        allBookmarks.slice(0, count / 2).map((b) => b.tweetId),
      );

      const pageSize = 100;
      const pages: Bookmark[][] = [];
      for (let i = 0; i < allBookmarks.length; i += pageSize) {
        pages.push(allBookmarks.slice(i, i + pageSize));
      }

      const fetchPage = makePaginatedFetcher(pages);

      const start = performance.now();
      const result = await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: true,
      });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(result.newBookmarks).toHaveLength(count / 2);
      expect(result.staleIds).toHaveLength(0);
    });
  });

  describe("onPage callback", () => {
    it("calls onPage for each page that contains new bookmarks", async () => {
      const localIds = new Set(["1"]);
      const pageCallArgs: Bookmark[][] = [];

      const fetchPage = makePaginatedFetcher([
        [makeBookmark("1"), makeBookmark("2")],
        [makeBookmark("3"), makeBookmark("4")],
      ]);

      await reconcileBookmarks({
        localIds,
        fetchPage,
        fullReconcile: false,
        onPage: (newBookmarks) => {
          pageCallArgs.push([...newBookmarks]);
        },
      });

      expect(pageCallArgs).toHaveLength(2);
      expect(pageCallArgs[0].map((b) => b.tweetId)).toEqual(["2"]);
      expect(pageCallArgs[1].map((b) => b.tweetId)).toEqual(["3", "4"]);
    });
  });
});
