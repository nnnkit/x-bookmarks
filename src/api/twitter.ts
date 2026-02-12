import type {
  ArticleContent,
  Bookmark,
  Media,
  ThreadTweet,
  TweetUrl,
} from "../types";
import {
  getTweetDetailCache,
  upsertTweetDetailCache,
} from "../db";

type UnknownRecord = Record<string, unknown>;

interface ParsedTweetRecord {
  bookmark: Bookmark;
  conversationId: string;
}

interface DetailTimelineTweet {
  bookmark: Bookmark;
  conversationId: string;
  tweetDisplayType: string;
  entryId: string;
}

export interface TweetDetailContent {
  focalTweet: Bookmark | null;
  thread: ThreadTweet[];
}

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export interface GraphQLEndpointCatalogEntry {
  key: string;
  operation: string;
  queryId: string;
  path: string;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  methods: string[];
  sampleUrl: string;
  sampleVariables: string | null;
  sampleFeatures: string | null;
  sampleFieldToggles: string | null;
}

export interface GraphQLEndpointCatalog {
  generatedAt: number;
  updatedAt: number;
  endpoints: GraphQLEndpointCatalogEntry[];
}

export interface GraphQLDocsExport {
  markdown: string;
  fileName: string;
  generatedAt: number;
}

export type BookmarkChangeType = "CreateBookmark" | "DeleteBookmark";

export interface BookmarkChangeEvent {
  id: string;
  type: BookmarkChangeType;
  tweetId: string;
  at: number;
  source: string;
}

export async function checkAuth() {
  return chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
}

export async function startAuthCapture() {
  return chrome.runtime.sendMessage({ type: "START_AUTH_CAPTURE" });
}

export async function closeAuthTab() {
  await chrome.runtime.sendMessage({ type: "CLOSE_AUTH_TAB" });
}

export async function checkReauthStatus() {
  return chrome.runtime.sendMessage({ type: "REAUTH_STATUS" });
}

export async function fetchGraphqlCatalog(): Promise<GraphQLEndpointCatalog> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_GRAPHQL_CATALOG",
  });
  if (response?.error) throw new Error(response.error);

  const data = response?.data;
  const endpoints = Array.isArray(data?.endpoints) ? data.endpoints : [];

  return {
    generatedAt: Number(data?.generatedAt || Date.now()),
    updatedAt: Number(data?.updatedAt || 0),
    endpoints: endpoints as GraphQLEndpointCatalogEntry[],
  };
}

export async function exportGraphqlDocs(): Promise<GraphQLDocsExport> {
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_GRAPHQL_DOCS",
  });
  if (response?.error) throw new Error(response.error);

  const data = response?.data;
  const markdown = typeof data?.markdown === "string" ? data.markdown : "";
  const fileName =
    typeof data?.fileName === "string"
      ? data.fileName
      : "x-graphql-api-docs.md";

  return {
    markdown,
    fileName,
    generatedAt: Number(data?.generatedAt || Date.now()),
  };
}

export async function deleteBookmark(tweetId: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "DELETE_BOOKMARK",
    tweetId,
  });
  if (response?.error) throw new Error(response.error);
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

export async function getBookmarkEvents(): Promise<BookmarkChangeEvent[]> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_BOOKMARK_EVENTS",
  });
  if (response?.error) throw new Error(response.error);
  return normalizeBookmarkChangeEvents(response?.data?.events);
}

export async function ackBookmarkEvents(ids: string[]): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "ACK_BOOKMARK_EVENTS",
    ids,
  });
  if (response?.error) throw new Error(response.error);
}

export async function drainBookmarkEvents(): Promise<BookmarkChangeEvent[]> {
  const response = await chrome.runtime.sendMessage({
    type: "DRAIN_BOOKMARK_EVENTS",
  });
  if (response?.error) throw new Error(response.error);

  return normalizeBookmarkChangeEvents(response?.data?.events);
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function asRecords(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is UnknownRecord =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toTimestamp(value: unknown): number {
  const dateString = asString(value);
  if (!dateString) return 0;
  const parsed = Date.parse(dateString);
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileImageUrl(value: unknown): string {
  const url = asString(value) || "";
  return url.replace("_normal", "_bigger");
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseUrlMappings(
  entities: UnknownRecord | null,
): { url: string; expanded_url: string }[] {
  const urls = asRecords(entities?.urls);
  return urls.map((url) => ({
    url: asString(url.url) || "",
    expanded_url: asString(url.expanded_url) || "",
  }));
}

function parseUrls(entities: UnknownRecord | null): TweetUrl[] {
  const urls = asRecords(entities?.urls);
  return urls
    .map((url) => ({
      url: asString(url.url) || "",
      displayUrl: asString(url.display_url) || "",
      expandedUrl: asString(url.expanded_url) || "",
    }))
    .filter((url) => Boolean(url.url || url.expandedUrl));
}

function expandText(
  text: string,
  urls: { url: string; expanded_url: string }[],
): string {
  for (const url of urls) {
    if (url.url && url.expanded_url) {
      text = text.split(url.url).join(url.expanded_url);
    }
  }

  // Strip remaining t.co media URLs that cannot be expanded from entities.
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
}

function parseMedia(legacy: UnknownRecord): Media[] {
  const extendedEntities = asRecord(legacy.extended_entities);
  const entities = asRecord(legacy.entities);

  let rawMedia = asRecords(extendedEntities?.media);
  if (rawMedia.length === 0) {
    rawMedia = asRecords(entities?.media);
  }

  return rawMedia
    .map((media) => {
      const type = asString(media.type);
      if (type !== "photo" && type !== "video" && type !== "animated_gif") {
        return null;
      }

      const sizes = asRecord(media.sizes);
      const largeSize = asRecord(sizes?.large);

      const item: Media = {
        type,
        url: asString(media.media_url_https) || asString(media.media_url) || "",
        width: toNumber(largeSize?.w),
        height: toNumber(largeSize?.h),
        altText: asString(media.ext_alt_text) || undefined,
      };

      if (type === "video" || type === "animated_gif") {
        const videoInfo = asRecord(media.video_info);
        const variants = asRecords(videoInfo?.variants).filter(
          (variant) => asString(variant.content_type) === "video/mp4",
        );

        if (variants.length > 0) {
          const sortedVariants = variants
            .slice()
            .sort((a, b) => toNumber(a.bitrate) - toNumber(b.bitrate));
          const best = sortedVariants[sortedVariants.length - 1];
          item.videoUrl = asString(best?.url) || undefined;
        }
      }

      return item;
    })
    .filter((item): item is Media => item !== null);
}

function unwrapTweet(result: UnknownRecord | null): UnknownRecord | null {
  if (!result) return null;

  const typename = asString(result.__typename);
  if (typename === "TweetWithVisibilityResults") {
    return asRecord(result.tweet);
  }

  if (typename === "TweetTombstone" || typename === "TweetUnavailable") {
    return null;
  }

  return asRecord(result.legacy) ? result : null;
}

function parseTweetText(tweet: UnknownRecord, legacy: UnknownRecord) {
  const noteTweet = asRecord(tweet.note_tweet);
  const noteResult = asRecord(asRecord(noteTweet?.note_tweet_results)?.result);

  if (noteResult) {
    const noteEntities = asRecord(noteResult.entity_set);
    const noteText = asString(noteResult.text);
    if (noteText) {
      return {
        text: expandText(noteText, parseUrlMappings(noteEntities)),
        urls: parseUrls(noteEntities),
        isLongText: true,
      };
    }
  }

  const entities = asRecord(legacy.entities);
  const fullText = asString(legacy.full_text) || "";
  const expanded = expandText(fullText, parseUrlMappings(entities));
  const urls = parseUrls(entities);
  const article = extractArticle(tweet);

  const isUrlOnly =
    Boolean(expanded) &&
    expanded.split(/\s+/).every((part) => /^https?:\/\//i.test(part));

  const articleFallback = compactText(
    pickLongest([article?.title || null, article?.plainText || null]),
  );

  return {
    text:
      !expanded || isUrlOnly
        ? articleFallback || expanded
        : expanded,
    urls,
    isLongText: false,
  };
}

function parseAuthor(core: UnknownRecord): Bookmark["author"] | null {
  const userResult = asRecord(asRecord(core.user_results)?.result);
  if (!userResult) return null;

  const userLegacy = asRecord(userResult.legacy);
  const userCore = asRecord(userResult.core);
  const avatar = asRecord(userResult.avatar);
  const verification = asRecord(userResult.verification);

  const name =
    asString(userLegacy?.name) ||
    asString(userCore?.name) ||
    asString(userResult.name) ||
    "Unknown";
  const screenName =
    asString(userLegacy?.screen_name) ||
    asString(userCore?.screen_name) ||
    asString(userResult.screen_name) ||
    "unknown";
  const imageUrl =
    userLegacy?.profile_image_url_https ||
    avatar?.image_url ||
    userLegacy?.profile_image_url ||
    "";

  return {
    name,
    screenName,
    profileImageUrl: profileImageUrl(imageUrl),
    verified:
      Boolean(userResult.is_blue_verified) ||
      Boolean(userLegacy?.verified) ||
      Boolean(verification?.verified),
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeArticleText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pickLongest(values: Array<string | null>): string {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort((a, b) => b.length - a.length)[0] || "";
}

function textFromArticleBlocks(contentState: UnknownRecord | null): string {
  if (!contentState) return "";
  const blocks = asRecords(contentState.blocks);
  if (blocks.length === 0) return "";

  const chunks: string[] = [];
  let inList = false;

  for (const block of blocks) {
    const type = asString(block.type) || "";
    const text = compactText(asString(block.text) || "");
    if (type === "atomic" || !text) continue;

    if (type === "unordered-list-item") {
      chunks.push(`• ${text}`);
      inList = true;
      continue;
    }

    if (type === "ordered-list-item") {
      chunks.push(`1. ${text}`);
      inList = true;
      continue;
    }

    if (inList) {
      chunks.push("");
      inList = false;
    }

    chunks.push(text);
    if (type.startsWith("header-")) {
      chunks.push("");
    }
  }

  return normalizeArticleText(chunks.join("\n"));
}

function articleTextFromNode(node: UnknownRecord): string {
  const contentState = asRecord(node.content_state);
  const body = asRecord(node.article_body);
  return pickLongest([
    asString(node.preview_text),
    asString(node.plain_text),
    asString(node.plainText),
    asString(node.article_plain_text),
    asString(body?.plain_text),
    asString(asRecord(node.body)?.plain_text),
    asString(asRecord(asRecord(node.content)?.article_body)?.plain_text),
    textFromArticleBlocks(contentState),
  ]);
}

function articleCoverImageFromNode(node: UnknownRecord): string {
  const coverMedia = asRecord(node.cover_media);
  const coverMediaInfo = asRecord(coverMedia?.media_info);
  const directMediaInfo = asRecord(node.media_info);
  const imageRecord = asRecord(node.image);

  return pickLongest([
    asString(coverMediaInfo?.original_img_url),
    asString(directMediaInfo?.original_img_url),
    asString(node.original_img_url),
    asString(node.image_url),
    asString(imageRecord?.url),
    asString(node.media_url_https),
    asString(node.media_url),
  ]);
}

function extractArticle(tweet: UnknownRecord): ArticleContent | null {
  const queue: Array<{ value: unknown; articleHint: boolean }> = [
    { value: tweet.article, articleHint: true },
    { value: tweet.article_results, articleHint: true },
    { value: asRecord(asRecord(tweet.article)?.article_results)?.result, articleHint: true },
    { value: tweet.card, articleHint: true },
    { value: tweet.unified_card, articleHint: true },
    { value: tweet, articleHint: false },
  ];

  const seen = new Set<object>();
  let best: ArticleContent | null = null;
  let bestCoverImage = "";

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const parsedJson = parseMaybeJson(current.value);
    const value = parsedJson ?? current.value;

    if (Array.isArray(value)) {
      for (const item of value) {
        queue.push({ value: item, articleHint: current.articleHint });
      }
      continue;
    }

    const node = asRecord(value);
    if (!node) continue;

    if (seen.has(node)) continue;
    seen.add(node);

    const keys = Object.keys(node);
    const hasArticleKey = keys.some((key) => key.toLowerCase().includes("article"));
    const isLikelyArticleNode = current.articleHint || hasArticleKey;
    const coverImage = articleCoverImageFromNode(node);
    if (isLikelyArticleNode && coverImage && coverImage.length > bestCoverImage.length) {
      bestCoverImage = coverImage;
    }

    const articleBody = asRecord(node.article_body);
    const plainText = articleTextFromNode(node);

    if (plainText && isLikelyArticleNode) {
      const normalized = normalizeArticleText(plainText);
      if (normalized) {
        const title = pickLongest([
          asString(node.title),
          asString(node.display_title),
          asString(articleBody?.title),
          asString(asRecord(asRecord(node.article_results)?.result)?.title),
        ]);

        const candidate: ArticleContent = {
          plainText: normalized,
          title: title || undefined,
          coverImageUrl: coverImage || undefined,
        };

        if (!best || candidate.plainText.length > best.plainText.length) {
          best = candidate;
        }
      }
    }

    for (const [key, child] of Object.entries(node)) {
      const lowerKey = key.toLowerCase();
      queue.push({
        value: parseMaybeJson(child) ?? child,
        articleHint:
          current.articleHint || hasArticleKey || lowerKey.includes("article"),
      });
    }
  }

  if (best && !best.coverImageUrl && bestCoverImage) {
    best.coverImageUrl = bestCoverImage;
  }

  return best;
}

function parseQuotedTweet(tweet: UnknownRecord): Bookmark["quotedTweet"] {
  const quotedResult = asRecord(asRecord(tweet.quoted_status_result)?.result);
  const quoted = unwrapTweet(quotedResult);
  if (!quoted) return null;

  const legacy = asRecord(quoted.legacy);
  const core = asRecord(quoted.core);
  if (!legacy || !core) return null;

  const author = parseAuthor(core);
  if (!author) return null;

  const { text } = parseTweetText(quoted, legacy);

  return {
    tweetId: asString(legacy.id_str) || asString(quoted.rest_id) || "",
    text,
    createdAt: toTimestamp(legacy.created_at),
    author,
    media: parseMedia(legacy),
  };
}

function parseTweetRecord(
  raw: UnknownRecord,
  sortIndex?: string,
): ParsedTweetRecord | null {
  try {
    const tweet = unwrapTweet(raw);
    if (!tweet) return null;

    const legacy = asRecord(tweet.legacy);
    const core = asRecord(tweet.core);
    if (!legacy || !core) return null;

    const author = parseAuthor(core);
    if (!author) return null;

    const { text, urls, isLongText } = parseTweetText(tweet, legacy);
    const media = parseMedia(legacy);
    const views = asRecord(tweet.views);

    const tweetId = asString(legacy.id_str) || asString(tweet.rest_id) || "";
    if (!tweetId) return null;

    const bookmark: Bookmark = {
      id: tweetId,
      tweetId,
      text,
      createdAt: toTimestamp(legacy.created_at),
      sortIndex: sortIndex || tweetId,
      author,
      metrics: {
        likes: toNumber(legacy.favorite_count),
        retweets: toNumber(legacy.retweet_count),
        replies: toNumber(legacy.reply_count),
        views: toNumber(views?.count),
        bookmarks: toNumber(legacy.bookmark_count),
      },
      media,
      urls,
      isThread: Boolean(asRecord(legacy.self_thread)),
      hasImage: media.some((item) => item.type === "photo"),
      hasVideo: media.some(
        (item) => item.type === "video" || item.type === "animated_gif",
      ),
      hasLink: urls.length > 0,
      isLongText,
      quotedTweet: parseQuotedTweet(tweet),
      article: extractArticle(tweet),
    };

    return {
      bookmark,
      conversationId: asString(legacy.conversation_id_str) || tweetId,
    };
  } catch {
    return null;
  }
}

interface FetchResult {
  bookmarks: Bookmark[];
  cursor: string | null;
}

export async function fetchBookmarkPage(
  cursor?: string,
): Promise<FetchResult> {
  const response = await chrome.runtime.sendMessage({
    type: "FETCH_BOOKMARKS",
    cursor,
  });

  if (response.error) throw new Error(response.error);

  const timeline = asRecord(
    asRecord(asRecord(response.data)?.data)?.bookmark_timeline_v2,
  )?.timeline;
  const timelineRecord = asRecord(timeline);
  if (!timelineRecord) return { bookmarks: [], cursor: null };

  const addEntries = asRecords(timelineRecord.instructions).find(
    (instruction) => instruction.type === "TimelineAddEntries",
  );
  if (!addEntries) return { bookmarks: [], cursor: null };

  const entries = asRecords(addEntries.entries);
  const bookmarks: Bookmark[] = [];
  let nextCursor: string | null = null;

  for (const entry of entries) {
    const entryId = asString(entry.entryId) || "";

    if (entryId.startsWith("cursor-bottom")) {
      nextCursor = asString(asRecord(entry.content)?.value);
      continue;
    }

    if (!entryId.startsWith("tweet-")) continue;

    const content = asRecord(entry.content);
    const itemContent = asRecord(content?.itemContent);
    const tweetResult = asRecord(asRecord(itemContent?.tweet_results)?.result);
    if (!tweetResult) continue;

    const parsed = parseTweetRecord(tweetResult, asString(entry.sortIndex) || undefined);
    if (!parsed) continue;

    bookmarks.push(parsed.bookmark);
  }

  return { bookmarks, cursor: nextCursor };
}

function parseItemContent(
  itemContent: UnknownRecord | null,
  sortIndex: string | undefined,
  entryId: string,
): DetailTimelineTweet | null {
  if (!itemContent || asString(itemContent.itemType) !== "TimelineTweet") {
    return null;
  }

  const tweetResult = asRecord(asRecord(itemContent.tweet_results)?.result);
  if (!tweetResult) return null;

  const parsed = parseTweetRecord(tweetResult, sortIndex);
  if (!parsed) return null;

  return {
    bookmark: parsed.bookmark,
    conversationId: parsed.conversationId,
    tweetDisplayType: asString(itemContent.tweetDisplayType) || "Tweet",
    entryId,
  };
}

function parseDetailTimelineTweets(payload: unknown): DetailTimelineTweet[] {
  const data = asRecord(asRecord(payload)?.data);
  const threaded = asRecord(data?.threaded_conversation_with_injections_v2);
  const instructions = asRecords(threaded?.instructions);

  const timelineTweets: DetailTimelineTweet[] = [];

  for (const instruction of instructions) {
    if (instruction.type !== "TimelineAddEntries") continue;

    for (const entry of asRecords(instruction.entries)) {
      const entryId = asString(entry.entryId) || "";
      const sortIndex = asString(entry.sortIndex) || undefined;
      const content = asRecord(entry.content);
      if (!content) continue;

      const timelineItem = parseItemContent(
        asRecord(content.itemContent),
        sortIndex,
        entryId,
      );
      if (timelineItem) {
        timelineTweets.push(timelineItem);
      }

      for (const item of asRecords(content.items)) {
        const moduleItemContent = asRecord(asRecord(item.item)?.itemContent);
        const moduleTweet = parseItemContent(
          moduleItemContent,
          sortIndex,
          asString(item.entryId) || entryId,
        );

        if (moduleTweet) {
          timelineTweets.push(moduleTweet);
        }
      }
    }
  }

  return timelineTweets;
}

function toThreadTweet(bookmark: Bookmark): ThreadTweet {
  return {
    tweetId: bookmark.tweetId,
    text: bookmark.text,
    createdAt: bookmark.createdAt,
    author: bookmark.author,
    media: bookmark.media,
    urls: bookmark.urls,
    article: bookmark.article || null,
  };
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

  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "FETCH_TWEET_DETAIL",
      tweetId,
    });
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
    throw new Error(response.error);
  }

  const responseData = asRecord(response.data);
  const directTweetResult = asRecord(
    asRecord(asRecord(responseData?.data)?.tweetResult)?.result,
  );
  const timelineTweets = parseDetailTimelineTweets(response.data);
  if (timelineTweets.length === 0) {
    if (directTweetResult) {
      const parsed = parseTweetRecord(directTweetResult);
      if (parsed) {
        const detail: TweetDetailContent = { focalTweet: parsed.bookmark, thread: [] };
        await upsertTweetDetailCache({
          tweetId,
          fetchedAt: Date.now(),
          focalTweet: detail.focalTweet,
          thread: detail.thread,
        }).catch(() => {});
        return detail;
      }
    }
    return { focalTweet: null, thread: [] };
  }

  const focal =
    timelineTweets.find((item) => item.bookmark.tweetId === tweetId) ||
    timelineTweets.find((item) => item.entryId.includes(tweetId)) ||
    null;

  const focalTweet = focal?.bookmark || null;

  let threadCandidates = timelineTweets.filter(
    (item) =>
      item.bookmark.tweetId !== tweetId && item.tweetDisplayType === "SelfThread",
  );

  // Fallback for response variations where self-thread tweets are not tagged.
  if (threadCandidates.length === 0 && focalTweet) {
    threadCandidates = timelineTweets.filter(
      (item) =>
        item.bookmark.tweetId !== tweetId &&
        item.conversationId === focalTweet.tweetId &&
        item.bookmark.author.screenName === focalTweet.author.screenName,
    );
  }

  const seen = new Set<string>();
  const thread = threadCandidates
    .filter((item) => {
      if (seen.has(item.bookmark.tweetId)) return false;
      seen.add(item.bookmark.tweetId);
      return true;
    })
    .map((item) => toThreadTweet(item.bookmark));

  const detail: TweetDetailContent = {
    focalTweet,
    thread,
  };
  await upsertTweetDetailCache({
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
