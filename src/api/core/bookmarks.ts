import { asRecord, asString, toNumber } from "../../lib/json";
import {
  parseBookmarkPagePayload,
  type BookmarkPageResult,
} from "../parsers";

export type BookmarkChangeType = "CreateBookmark" | "DeleteBookmark";

export interface BookmarkChangeEvent {
  id: string;
  type: BookmarkChangeType;
  tweetId: string;
  at: number;
  source: string;
}

interface RuntimeResponse {
  error?: string;
  data?: unknown;
}

function runtimeError(response: RuntimeResponse): string {
  return response.error || "API_ERROR";
}

function normalizeBookmarkChangeEvents(value: unknown): BookmarkChangeEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      const type = asString(record?.type);
      const tweetId = asString(record?.tweetId);
      if (type !== "CreateBookmark" && type !== "DeleteBookmark") return null;
      const at = toNumber(record?.at);
      const source = asString(record?.source) || "unknown";
      const id =
        asString(record?.id) ||
        `${type}-${at || Date.now()}-${tweetId || "unknown"}-${index}`;
      return {
        id,
        type,
        tweetId: tweetId || "",
        at,
        source,
      };
    })
    .filter((event): event is BookmarkChangeEvent => event !== null);
}

export async function fetchBookmarkPage(
  cursor?: string,
): Promise<BookmarkPageResult> {
  const response = (await chrome.runtime.sendMessage({
    type: "FETCH_BOOKMARKS",
    cursor,
  })) as RuntimeResponse;

  if (response?.error) throw new Error(runtimeError(response));
  return parseBookmarkPagePayload(response?.data);
}

export async function deleteBookmark(tweetId: string): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: "DELETE_BOOKMARK",
    tweetId,
  })) as RuntimeResponse;
  if (response?.error) throw new Error(runtimeError(response));
}

export async function getBookmarkEvents(): Promise<BookmarkChangeEvent[]> {
  const response = (await chrome.runtime.sendMessage({
    type: "GET_BOOKMARK_EVENTS",
  })) as RuntimeResponse;

  if (response?.error) throw new Error(runtimeError(response));
  return normalizeBookmarkChangeEvents(asRecord(response?.data)?.events);
}

export async function ackBookmarkEvents(ids: string[]): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: "ACK_BOOKMARK_EVENTS",
    ids,
  })) as RuntimeResponse;

  if (response?.error) throw new Error(runtimeError(response));
}
