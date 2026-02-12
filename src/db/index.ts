import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Bookmark, TweetDetailCache } from "../types";

const DB_NAME = "xbt";
const DB_VERSION = 4;
const STORE_NAME = "bookmarks";
const DETAIL_STORE_NAME = "tweet_details";

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
  await db.clear(STORE_NAME);
}

export async function deleteBookmarksByTweetIds(tweetIds: string[]): Promise<void> {
  if (tweetIds.length === 0) return;

  const uniqueIds = Array.from(new Set(tweetIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const db = await getDb();
  const tx = db.transaction([STORE_NAME, DETAIL_STORE_NAME], "readwrite");
  const bookmarkStore = tx.objectStore(STORE_NAME);
  const detailStore = tx.objectStore(DETAIL_STORE_NAME);
  const tweetIndex = bookmarkStore.index("tweetId");

  for (const tweetId of uniqueIds) {
    const bookmarkIds = await tweetIndex.getAllKeys(IDBKeyRange.only(tweetId));
    for (const bookmarkId of bookmarkIds) {
      await bookmarkStore.delete(bookmarkId as string);
    }
    await detailStore.delete(tweetId);
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
