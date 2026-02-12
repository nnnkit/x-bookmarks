import { useState, useEffect, useCallback, useRef } from "react";
import type { Bookmark, SyncState } from "../types";
import {
  fetchBookmarkPage,
  checkReauthStatus,
  checkAuth,
  deleteBookmark,
  getBookmarkEvents,
  ackBookmarkEvents,
} from "../api/twitter";
import {
  upsertBookmarks,
  getAllBookmarks,
  clearBookmarks,
  deleteBookmarksByTweetIds,
} from "../db";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncState: SyncState;
  refresh: () => void;
  unbookmark: (tweetId: string) => Promise<void>;
}

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
}

function buildTopSignature(items: Bookmark[]): string {
  return items
    .slice(0, 10)
    .map((item) => `${item.tweetId}:${item.sortIndex}`)
    .join("|");
}

function reconcileTopWindow(
  previous: Bookmark[],
  incoming: Bookmark[],
): { merged: Bookmark[]; deletedTweetIds: string[] } {
  const incomingSorted = [...incoming].sort(compareSortIndexDesc);
  const previousSorted = [...previous].sort(compareSortIndexDesc);
  const incomingIds = new Set(incomingSorted.map((bookmark) => bookmark.tweetId));

  const previousTopWindow = previousSorted.slice(0, incomingSorted.length);
  const deletedTweetIds = previousTopWindow
    .filter((bookmark) => !incomingIds.has(bookmark.tweetId))
    .map((bookmark) => bookmark.tweetId);

  const mergedByTweetId = new Map(
    previous.map((bookmark) => [bookmark.tweetId, bookmark]),
  );
  for (const tweetId of deletedTweetIds) {
    mergedByTweetId.delete(tweetId);
  }
  for (const bookmark of incomingSorted) {
    mergedByTweetId.set(bookmark.tweetId, bookmark);
  }

  return {
    merged: Array.from(mergedByTweetId.values()).sort(compareSortIndexDesc),
    deletedTweetIds,
  };
}

export function useBookmarks(isReady: boolean): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    phase: "idle",
    total: 0,
  });
  const syncingRef = useRef(false);
  const processingBookmarkEventsRef = useRef(false);
  const bookmarksRef = useRef<Bookmark[]>([]);

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  // Load from IndexedDB on mount
  useEffect(() => {
    if (!isReady) return;
    getAllBookmarks().then((stored) => {
      if (stored.length > 0) {
        setBookmarks(stored);
        setSyncState({ phase: "done", total: stored.length });
      }
    });
  }, [isReady]);

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    setSyncState((prev) => ({
      phase: "syncing",
      total: prev.total || bookmarksRef.current.length,
    }));

    try {
      const result = await fetchBookmarkPage();
      const incoming = result.bookmarks;
      const current = bookmarksRef.current;
      const incomingSignature = buildTopSignature(incoming);
      const currentSignature = buildTopSignature(current);

      let nextTotal = current.length;

      if (incoming.length === 0) {
        if (current.length > 0) {
          await clearBookmarks();
          setBookmarks([]);
        }
        nextTotal = 0;
      } else if (incomingSignature !== currentSignature) {
        const incomingSorted = [...incoming].sort(compareSortIndexDesc);
        const { merged, deletedTweetIds } = reconcileTopWindow(current, incomingSorted);

        await upsertBookmarks(incomingSorted);
        if (deletedTweetIds.length > 0) {
          await deleteBookmarksByTweetIds(deletedTweetIds);
        }

        setBookmarks(merged);
        nextTotal = merged.length;
      }

      await chrome.storage.local.set({ last_sync: Date.now() });
      setSyncState({ phase: "done", total: nextTotal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg === "AUTH_EXPIRED" || msg === "NO_AUTH") {
        setSyncState({
          phase: "error",
          total: bookmarksRef.current.length,
          error: "reconnecting",
        });

        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const status = await checkReauthStatus();
            if (!status.inProgress) {
              const auth = await checkAuth();
              if (auth.hasAuth && auth.hasQueryId) {
                clearInterval(pollInterval);
                syncingRef.current = false;
                doSync();
                return;
              }
            }
          } catch {}
          if (attempts >= 15) {
            clearInterval(pollInterval);
            setSyncState({
              phase: "error",
              total: bookmarksRef.current.length,
              error: msg,
            });
          }
        }, 2000);
      } else {
        setSyncState({
          phase: "error",
          total: bookmarksRef.current.length,
          error: msg,
        });
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const refresh = useCallback(() => {
    doSync();
  }, [doSync]);

  const applyBookmarkEvents = useCallback(async () => {
    if (processingBookmarkEventsRef.current) return;
    processingBookmarkEventsRef.current = true;

    try {
      const events = await getBookmarkEvents();
      if (events.length === 0) return;

      const ackIds: string[] = [];
      const deleteEvents = events.filter((event) => event.type === "DeleteBookmark");
      const createEvents = events.filter((event) => event.type === "CreateBookmark");

      const deletedIds = Array.from(
        new Set(deleteEvents.map((event) => event.tweetId).filter(Boolean)),
      );

      if (deletedIds.length > 0) {
        const toDelete = new Set(deletedIds);
        let nextTotal = 0;

        setBookmarks((prev) => {
          const filtered = prev.filter((bookmark) => !toDelete.has(bookmark.tweetId));
          nextTotal = filtered.length;
          return filtered;
        });

        await deleteBookmarksByTweetIds(deletedIds);
        setSyncState((prev) => ({
          ...prev,
          phase: prev.phase === "idle" ? "done" : prev.phase,
          total: nextTotal,
        }));
        ackIds.push(...deleteEvents.map((event) => event.id));
      } else if (deleteEvents.length > 0) {
        // If we could not recover tweet IDs from mutation requests, try a top-page refresh.
        await doSync();
        ackIds.push(...deleteEvents.map((event) => event.id));
      }

      if (createEvents.length > 0) {
        await doSync();
        ackIds.push(...createEvents.map((event) => event.id));
      }

      if (ackIds.length > 0) {
        await ackBookmarkEvents(Array.from(new Set(ackIds)));
      }
    } finally {
      processingBookmarkEventsRef.current = false;
    }
  }, [doSync]);

  const unbookmark = useCallback(async (tweetId: string) => {
    if (!tweetId) return;

    let removed: Bookmark | null = null;
    setBookmarks((prev) => {
      removed = prev.find((bookmark) => bookmark.tweetId === tweetId) || null;
      return prev.filter((bookmark) => bookmark.tweetId !== tweetId);
    });

    await deleteBookmarksByTweetIds([tweetId]);

    try {
      await deleteBookmark(tweetId);
      setSyncState((prev) => ({
        ...prev,
        phase: prev.phase === "idle" ? "done" : prev.phase,
        total: Math.max(0, prev.total - 1),
      }));
    } catch (error) {
      if (removed) {
        const removedBookmark = removed;
        await upsertBookmarks([removedBookmark]);
        setBookmarks((prev) => {
          if (prev.some((bookmark) => bookmark.tweetId === tweetId)) return prev;
          return [removedBookmark, ...prev].sort(compareSortIndexDesc);
        });
      }
      throw error;
    }
  }, []);

  // Sync top window on mount.
  useEffect(() => {
    if (!isReady) return;
    doSync();
  }, [isReady, doSync]);

  // Sync again when tab becomes visible.
  useEffect(() => {
    if (!isReady) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        doSync();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isReady, doSync]);

  useEffect(() => {
    if (!isReady) return;

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (changes.tw_bookmark_events) {
        applyBookmarkEvents().catch(() => {});
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    applyBookmarkEvents().catch(() => {});

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [isReady, applyBookmarkEvents]);

  return { bookmarks, syncState, refresh, unbookmark };
}
