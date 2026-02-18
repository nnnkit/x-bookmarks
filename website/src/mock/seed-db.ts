import { MOCK_BOOKMARKS } from "./bookmarks";
import {
  upsertBookmarks,
  upsertTweetDetailCache,
  upsertReadingProgress,
} from "@ext/db";
import type { TweetDetailCache, ReadingProgress } from "@ext/types";

export async function seedDatabase() {
  // Seed bookmarks into IndexedDB
  await upsertBookmarks(MOCK_BOOKMARKS);

  // Seed tweet detail cache so ReaderView finds cached data
  // (fetchTweetDetail checks IndexedDB before calling chrome.runtime.sendMessage)
  for (const bookmark of MOCK_BOOKMARKS) {
    const detail: TweetDetailCache = {
      tweetId: bookmark.tweetId,
      fetchedAt: Date.now(),
      focalTweet: bookmark,
      thread: [],
    };
    await upsertTweetDetailCache(detail);
  }

  // Seed reading progress entries for "Continue Reading" section
  const progressEntries: ReadingProgress[] = [
    {
      tweetId: "1003", // antirez article — 35% read
      scrollPercent: 35,
      scrollY: 420,
      scrollHeight: 1200,
      lastReadAt: Date.now() - 2 * 60 * 60 * 1000,
      completed: false,
    },
    {
      tweetId: "1010", // kelseyhightower thread — 62% read
      scrollPercent: 62,
      scrollY: 680,
      scrollHeight: 1100,
      lastReadAt: Date.now() - 5 * 60 * 60 * 1000,
      completed: false,
    },
    {
      tweetId: "1006", // karpathy long post — completed
      scrollPercent: 92,
      scrollY: 1080,
      scrollHeight: 1200,
      lastReadAt: Date.now() - 24 * 60 * 60 * 1000,
      completed: true,
    },
  ];

  for (const progress of progressEntries) {
    await upsertReadingProgress(progress);
  }
}
