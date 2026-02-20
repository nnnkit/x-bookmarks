import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Bookmark, TweetDetailCache, ReadingProgress } from "../types";

const DB_NAME = "xbt";
const DB_VERSION = 5;
const STORE_NAME = "bookmarks";
const DETAIL_STORE_NAME = "tweet_details";
const PROGRESS_STORE_NAME = "reading_progress";

interface XBookmarksDbSchema extends DBSchema {
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: {
      tweetId: string;
      sortIndex: string;
      createdAt: number;
      screenName: string;
    };
  };
  tweet_details: {
    key: string;
    value: TweetDetailCache;
    indexes: {
      fetchedAt: number;
    };
  };
  reading_progress: {
    key: string;
    value: ReadingProgress;
    indexes: {
      lastReadAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<XBookmarksDbSchema>> | null = null;

function createDb() {
  return openDB<XBookmarksDbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      const bookmarksStore = db.objectStoreNames.contains(STORE_NAME)
        ? tx.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });

      if (!bookmarksStore.indexNames.contains("tweetId")) {
        bookmarksStore.createIndex("tweetId", "tweetId", { unique: false });
      }
      if (!bookmarksStore.indexNames.contains("sortIndex")) {
        bookmarksStore.createIndex("sortIndex", "sortIndex", { unique: false });
      }
      if (!bookmarksStore.indexNames.contains("createdAt")) {
        bookmarksStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!bookmarksStore.indexNames.contains("screenName")) {
        bookmarksStore.createIndex("screenName", "author.screenName", {
          unique: false,
        });
      }

      const detailStore = db.objectStoreNames.contains(DETAIL_STORE_NAME)
        ? tx.objectStore(DETAIL_STORE_NAME)
        : db.createObjectStore(DETAIL_STORE_NAME, {
            keyPath: "tweetId",
          });

      if (!detailStore.indexNames.contains("fetchedAt")) {
        detailStore.createIndex("fetchedAt", "fetchedAt", { unique: false });
      }

      const progressStore = db.objectStoreNames.contains(PROGRESS_STORE_NAME)
        ? tx.objectStore(PROGRESS_STORE_NAME)
        : db.createObjectStore(PROGRESS_STORE_NAME, { keyPath: "tweetId" });

      if (!progressStore.indexNames.contains("lastReadAt")) {
        progressStore.createIndex("lastReadAt", "lastReadAt", { unique: false });
      }
    },
    blocked() {
      // Keep existing tabs open; app can continue with in-memory state until next refresh.
    },
    blocking() {
      dbPromise = null;
    },
    terminated() {
      dbPromise = null;
    },
  });
}

async function getDb(): Promise<IDBPDatabase<XBookmarksDbSchema>> {
  if (!dbPromise) {
    dbPromise = createDb().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function upsertBookmarks(bookmarks: Bookmark[]): Promise<void> {
  if (bookmarks.length === 0) return;

  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const bookmark of bookmarks) {
    tx.store.put(bookmark);
  }
  await tx.done;
}

export async function getAllBookmarks(): Promise<Bookmark[]> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const rows: Bookmark[] = [];

  let cursor = await tx.store.index("sortIndex").openCursor(null, "prev");
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return rows;
}

export async function getBookmarkCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

export async function clearBookmarks(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([STORE_NAME, PROGRESS_STORE_NAME], "readwrite");
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(PROGRESS_STORE_NAME).clear();
  await tx.done;
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    [STORE_NAME, DETAIL_STORE_NAME, PROGRESS_STORE_NAME],
    "readwrite",
  );
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(DETAIL_STORE_NAME).clear();
  tx.objectStore(PROGRESS_STORE_NAME).clear();
  await tx.done;
}

export async function deleteBookmarksByTweetIds(tweetIds: string[]): Promise<void> {
  if (tweetIds.length === 0) return;

  const uniqueIds = Array.from(new Set(tweetIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const db = await getDb();
  const tx = db.transaction([STORE_NAME, DETAIL_STORE_NAME, PROGRESS_STORE_NAME], "readwrite");
  const bookmarkStore = tx.objectStore(STORE_NAME);
  const detailStore = tx.objectStore(DETAIL_STORE_NAME);
  const progressStore = tx.objectStore(PROGRESS_STORE_NAME);
  const tweetIndex = bookmarkStore.index("tweetId");

  for (const tweetId of uniqueIds) {
    const bookmarkIds = await tweetIndex.getAllKeys(IDBKeyRange.only(tweetId));
    for (const bookmarkId of bookmarkIds) {
      await bookmarkStore.delete(bookmarkId as string);
    }
    await detailStore.delete(tweetId);
    await progressStore.delete(tweetId);
  }

  await tx.done;
}

export async function upsertTweetDetailCache(
  detail: TweetDetailCache,
): Promise<void> {
  const db = await getDb();
  await db.put(DETAIL_STORE_NAME, detail);
}

export async function getTweetDetailCache(
  tweetId: string,
): Promise<TweetDetailCache | null> {
  if (!tweetId) return null;

  const db = await getDb();
  const cached = await db.get(DETAIL_STORE_NAME, tweetId);
  return cached || null;
}

export async function upsertReadingProgress(
  progress: ReadingProgress,
): Promise<void> {
  const db = await getDb();
  await db.put(PROGRESS_STORE_NAME, progress);
}

export async function ensureReadingProgressExists(
  tweetId: string,
): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  const existing = await db.get(PROGRESS_STORE_NAME, tweetId);
  const now = Date.now();
  if (existing) {
    await db.put(PROGRESS_STORE_NAME, { ...existing, lastReadAt: now });
  } else {
    await db.put(PROGRESS_STORE_NAME, {
      tweetId,
      openedAt: now,
      lastReadAt: now,
      scrollY: 0,
      scrollHeight: 0,
      completed: false,
    });
  }
}

export async function markReadingProgressCompleted(tweetId: string): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  const existing = await db.get(PROGRESS_STORE_NAME, tweetId);
  const now = Date.now();
  if (existing) {
    await db.put(PROGRESS_STORE_NAME, { ...existing, lastReadAt: now, completed: true });
  } else {
    await db.put(PROGRESS_STORE_NAME, {
      tweetId, openedAt: now, lastReadAt: now, scrollY: 0, scrollHeight: 0, completed: true,
    });
  }
}

export async function markReadingProgressUncompleted(tweetId: string): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  const existing = await db.get(PROGRESS_STORE_NAME, tweetId);
  if (existing) {
    await db.put(PROGRESS_STORE_NAME, { ...existing, lastReadAt: Date.now(), completed: false });
  }
}

export async function getReadingProgress(
  tweetId: string,
): Promise<ReadingProgress | null> {
  if (!tweetId) return null;
  const db = await getDb();
  const record = await db.get(PROGRESS_STORE_NAME, tweetId);
  return record || null;
}

export async function getAllReadingProgress(): Promise<ReadingProgress[]> {
  const db = await getDb();
  const tx = db.transaction(PROGRESS_STORE_NAME, "readonly");
  const rows: ReadingProgress[] = [];

  let cursor = await tx.store.index("lastReadAt").openCursor(null, "prev");
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return rows;
}

export async function deleteReadingProgress(tweetId: string): Promise<void> {
  if (!tweetId) return;
  const db = await getDb();
  await db.delete(PROGRESS_STORE_NAME, tweetId);
}

export async function deleteReadingProgressByTweetIds(
  tweetIds: string[],
): Promise<void> {
  if (tweetIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(PROGRESS_STORE_NAME, "readwrite");
  for (const tweetId of tweetIds) {
    await tx.store.delete(tweetId);
  }
  await tx.done;
}

export async function getDetailedTweetIds(): Promise<Set<string>> {
  const db = await getDb();
  const keys = await db.getAllKeys(DETAIL_STORE_NAME);
  return new Set(keys);
}

export async function cleanupOldTweetDetails(maxAgeMs: number): Promise<number> {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return 0;

  const cutoff = Date.now() - maxAgeMs;
  const db = await getDb();
  const tx = db.transaction(DETAIL_STORE_NAME, "readwrite");
  const fetchedAtIndex = tx.store.index("fetchedAt");

  let removed = 0;
  let cursor = await fetchedAtIndex.openCursor(IDBKeyRange.upperBound(cutoff));
  while (cursor) {
    await cursor.delete();
    removed += 1;
    cursor = await cursor.continue();
  }

  await tx.done;
  return removed;
}
