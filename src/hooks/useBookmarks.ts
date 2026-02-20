import { useState, useEffect, useCallback, useRef } from "react";
import type { Bookmark, SyncState } from "../types";
import {
  checkReauthStatus,
  checkAuth,
  deleteBookmark,
  getBookmarkEvents,
  ackBookmarkEvents,
  fetchBookmarkPage,
} from "../api/core";
import {
  upsertBookmarks,
  getAllBookmarks,
  deleteBookmarksByTweetIds,
  cleanupOldTweetDetails,
  getDetailedTweetIds,
} from "../db";
import { FetchQueue } from "../lib/fetch-queue";
import { reconcileBookmarks } from "../lib/reconcile";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  syncState: SyncState;
  refresh: () => void;
  unbookmark: (tweetId: string) => Promise<void>;
}

const WEEKLY_DB_CLEANUP_KEY = "tw_db_weekly_cleanup_at";
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const DETAIL_CACHE_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
const LAST_RECONCILE_KEY = "last_full_reconcile";
const RECONCILE_THROTTLE_MS = 1000 * 60 * 60 * 4;

function compareSortIndexDesc(a: Bookmark, b: Bookmark): number {
  return b.sortIndex.localeCompare(a.sortIndex);
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
  const reauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchQueueRef = useRef<FetchQueue | null>(null);

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  useEffect(() => {
    const runCleanup = async () => {
      try {
        const stored = await chrome.storage.local.get([WEEKLY_DB_CLEANUP_KEY]);
        const lastCleanup = Number(stored[WEEKLY_DB_CLEANUP_KEY] || 0);
        if (Date.now() - lastCleanup < WEEK_MS) return;

        await Promise.all([
          cleanupOldTweetDetails(DETAIL_CACHE_RETENTION_MS),
          chrome.storage.local.set({ [WEEKLY_DB_CLEANUP_KEY]: Date.now() }),
        ]);
      } catch {}
    };

    runCleanup().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    Promise.race([
      getAllBookmarks(),
      new Promise<Bookmark[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("DB_INIT_TIMEOUT")), 8000);
      }),
    ])
      .then((stored) => {
        if (cancelled) return;
        if (stored.length > 0) {
          setBookmarks(stored);
          setSyncState({ phase: "done", total: stored.length });
        } else {
          syncNewBookmarks({ fullReconcile: true });
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Fail open so UI is usable even when IndexedDB bootstrap stalls.
        setSyncState({ phase: "done", total: bookmarksRef.current.length });
      })
      .finally(() => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      });

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [isReady]);

  const handleSyncError = useCallback(
    (err: unknown, retryFn: () => void) => {
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg === "AUTH_EXPIRED" || msg === "NO_AUTH") {
        setSyncState({
          phase: "error",
          total: bookmarksRef.current.length,
          error: "reconnecting",
        });

        if (reauthPollRef.current !== null) {
          clearInterval(reauthPollRef.current);
        }

        let attempts = 0;
        reauthPollRef.current = setInterval(async () => {
          attempts++;
          try {
            const status = await checkReauthStatus();
            if (!status.inProgress) {
              const auth = await checkAuth();
              if (auth.hasAuth && auth.hasQueryId) {
                clearInterval(reauthPollRef.current!);
                reauthPollRef.current = null;
                syncingRef.current = false;
                retryFn();
                return;
              }
            }
          } catch {}
          if (attempts >= 15) {
            clearInterval(reauthPollRef.current!);
            reauthPollRef.current = null;
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
    },
    [],
  );

  const syncNewBookmarks = useCallback(
    async (opts?: { fullReconcile?: boolean }) => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      const queue = new FetchQueue();
      fetchQueueRef.current = queue;

      setSyncState((prev) => ({
        phase: "syncing",
        total: prev.total || bookmarksRef.current.length,
      }));

      let doReconcile = opts?.fullReconcile === true;
      if (doReconcile) {
        const stored = await chrome.storage.local.get([LAST_RECONCILE_KEY]);
        const lastReconcile = Number(stored[LAST_RECONCILE_KEY] || 0);
        if (Date.now() - lastReconcile < RECONCILE_THROTTLE_MS) {
          doReconcile = false;
        }
      }

      try {
        const existingIds = new Set(
          bookmarksRef.current.map((b) => b.tweetId),
        );

        const result = await reconcileBookmarks({
          localIds: existingIds,
          fetchPage: (cursor) =>
            queue.enqueue(() => fetchBookmarkPage(cursor)),
          fullReconcile: doReconcile,
          onPage: async (pageNew) => {
            await upsertBookmarks(pageNew);

            const updated = [...bookmarksRef.current, ...pageNew].toSorted(
              compareSortIndexDesc,
            );
            bookmarksRef.current = updated;
            setBookmarks(updated);
            setSyncState({ phase: "syncing", total: updated.length });
          },
        });

        if (!queue.isAborted) {
          if (doReconcile && result.staleIds.length > 0) {
            await deleteBookmarksByTweetIds(result.staleIds);
            const staleSet = new Set(result.staleIds);
            const filtered = bookmarksRef.current.filter(
              (b) => !staleSet.has(b.tweetId),
            );
            bookmarksRef.current = filtered;
            setBookmarks(filtered);
          }

          if (doReconcile) {
            await chrome.storage.local.set({
              [LAST_RECONCILE_KEY]: Date.now(),
            });
          }

          await chrome.storage.local.set({ last_sync: Date.now() });
          setSyncState({ phase: "done", total: bookmarksRef.current.length });
        }
      } catch (err) {
        if (!queue.isAborted) {
          handleSyncError(err, syncNewBookmarks);
        }
      } finally {
        syncingRef.current = false;
        fetchQueueRef.current = null;
      }
    },
    [handleSyncError],
  );

  const refresh = useCallback(() => {
    syncNewBookmarks({ fullReconcile: true });
  }, [syncNewBookmarks]);

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
        const current = bookmarksRef.current;
        const filtered = current.filter((bookmark) => !toDelete.has(bookmark.tweetId));

        if (filtered.length !== current.length) {
          bookmarksRef.current = filtered;
          setBookmarks(filtered);
        }

        await deleteBookmarksByTweetIds(deletedIds);
        setSyncState((prev) => ({
          ...prev,
          phase: prev.phase === "idle" ? "done" : prev.phase,
          total: filtered.length,
        }));
        ackIds.push(...deleteEvents.map((event) => event.id));
      } else if (deleteEvents.length > 0) {
        await syncNewBookmarks();
        ackIds.push(...deleteEvents.map((event) => event.id));
      }

      if (createEvents.length > 0) {
        await syncNewBookmarks();
        ackIds.push(...createEvents.map((event) => event.id));
      }

      if (ackIds.length > 0) {
        await ackBookmarkEvents(Array.from(new Set(ackIds)));
      }
    } finally {
      processingBookmarkEventsRef.current = false;
    }
  }, [syncNewBookmarks]);

  const unbookmark = useCallback(async (tweetId: string) => {
    if (!tweetId) return;

    const current = bookmarksRef.current;
    const removed = current.find((bookmark) => bookmark.tweetId === tweetId) || null;
    const filtered = current.filter((bookmark) => bookmark.tweetId !== tweetId);

    if (filtered.length !== current.length) {
      bookmarksRef.current = filtered;
      setBookmarks(filtered);
    }

    await deleteBookmarksByTweetIds([tweetId]);

    try {
      await deleteBookmark(tweetId);
      setSyncState((prev) => ({
        ...prev,
        phase: prev.phase === "idle" ? "done" : prev.phase,
        total: Math.max(0, prev.total - (removed ? 1 : 0)),
      }));
    } catch (error) {
      if (removed) {
        const removedBookmark = removed;
        await upsertBookmarks([removedBookmark]);
        const currentAfterError = bookmarksRef.current;
        if (!currentAfterError.some((bookmark) => bookmark.tweetId === tweetId)) {
          const restored = [removedBookmark, ...currentAfterError].toSorted(
            compareSortIndexDesc,
          );
          bookmarksRef.current = restored;
          setBookmarks(restored);
        }
      }
      throw error;
    }
  }, []);

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

  useEffect(() => {
    return () => {
      if (reauthPollRef.current !== null) {
        clearInterval(reauthPollRef.current);
      }
      if (fetchQueueRef.current) {
        fetchQueueRef.current.abort();
      }
    };
  }, []);

  return { bookmarks, syncState, refresh, unbookmark };
}

const EMPTY_SET = new Set<string>();

export function useDetailedTweetIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(EMPTY_SET);

  useEffect(() => {
    getDetailedTweetIds().then(setIds).catch(() => {});
  }, []);

  return ids;
}
