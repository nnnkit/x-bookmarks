import type { Bookmark } from "../types";
import type { BookmarkPageResult } from "../api/parsers";

interface ReconcileResult {
  newBookmarks: Bookmark[];
  staleIds: string[];
  pagesRequested: number;
}

interface ReconcileOptions {
  localIds: Set<string>;
  fetchPage: (cursor?: string) => Promise<BookmarkPageResult>;
  fullReconcile: boolean;
  onPage?: (newBookmarks: Bookmark[]) => void;
}

export async function reconcileBookmarks(
  opts: ReconcileOptions,
): Promise<ReconcileResult> {
  const { localIds, fetchPage, fullReconcile, onPage } = opts;
  const seen = new Set(localIds);
  const remoteIds = new Set<string>();
  const allNew: Bookmark[] = [];
  let cursor: string | undefined;
  let pagesRequested = 0;

  do {
    const result = await fetchPage(cursor);
    pagesRequested++;

    const pageNew = result.bookmarks.filter((b) => !seen.has(b.tweetId));

    if (fullReconcile) {
      for (const b of result.bookmarks) {
        remoteIds.add(b.tweetId);
      }
    }

    if (pageNew.length === 0 && !fullReconcile) break;

    if (pageNew.length > 0) {
      for (const b of pageNew) {
        seen.add(b.tweetId);
      }
      allNew.push(...pageNew);
      onPage?.(pageNew);
    }

    cursor = result.cursor || undefined;
  } while (cursor);

  let staleIds: string[] = [];
  if (fullReconcile) {
    staleIds = [...localIds].filter((id) => !remoteIds.has(id));
  }

  return { newBookmarks: allNew, staleIds, pagesRequested };
}
