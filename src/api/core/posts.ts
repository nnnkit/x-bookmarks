import { getTweetDetailCache, upsertTweetDetailCache } from "../../db";
import type { ThreadTweet } from "../../types";
import { parseTweetDetailPayload, type TweetDetailContent } from "../parsers";

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

interface RuntimeResponse {
  error?: string;
  data?: unknown;
}

function runtimeError(response: RuntimeResponse): string {
  return response.error || "DETAIL_ERROR";
}

export async function fetchTweetDetail(
  tweetId: string,
): Promise<TweetDetailContent> {
  const cached = await getTweetDetailCache(tweetId).catch(() => null);
  const cacheAge = cached ? Date.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;
  const isCacheFresh = Boolean(cached && cacheAge <= DETAIL_CACHE_TTL_MS);

  if (isCacheFresh && cached) {
    return {
      focalTweet: cached.focalTweet,
      thread: cached.thread,
    };
  }

  let response: RuntimeResponse;
  try {
    response = (await chrome.runtime.sendMessage({
      type: "FETCH_TWEET_DETAIL",
      tweetId,
    })) as RuntimeResponse;
  } catch (error) {
    if (cached) {
      return {
        focalTweet: cached.focalTweet,
        thread: cached.thread,
      };
    }
    throw error;
  }

  if (response.error) {
    if (cached) {
      return {
        focalTweet: cached.focalTweet,
        thread: cached.thread,
      };
    }
    throw new Error(runtimeError(response));
  }

  const detail = parseTweetDetailPayload(response.data, tweetId);
  upsertTweetDetailCache({
    tweetId,
    fetchedAt: Date.now(),
    focalTweet: detail.focalTweet,
    thread: detail.thread,
  }).catch(() => {});

  return detail;
}

export async function fetchThread(tweetId: string): Promise<ThreadTweet[]> {
  try {
    const detail = await fetchTweetDetail(tweetId);
    return detail.thread;
  } catch {
    return [];
  }
}
