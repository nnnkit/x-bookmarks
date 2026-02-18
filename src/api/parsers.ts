import type {
  ArticleContent,
  ArticleContentBlock,
  ArticleContentEntity,
  Bookmark,
  Media,
  ThreadTweet,
  TweetKind,
  TweetUrl,
} from "../types";
import {
  type UnknownRecord,
  asRecord,
  asRecords,
  asString,
  toNumber,
  toTimestamp,
  parseMaybeJson,
} from "../lib/json";
import { compactText, expandText, profileImageUrl } from "../lib/text";

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
          const sortedVariants = variants.toSorted(
            (a, b) => toNumber(a.bitrate) - toNumber(b.bitrate),
          );
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

function normalizeArticleText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pickLongest(values: Array<string | null>): string {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort((a, b) => b.length - a.length)[0] || "";
}

function isLikelyProfileImageUrl(value: string | null): boolean {
  if (!value) return false;
  return /\/profile_images\//i.test(value);
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

function parseInlineStyleRanges(
  value: unknown,
): ArticleContentBlock["inlineStyleRanges"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { offset: number; length: number; style: string } => {
        const r = asRecord(item);
        return (
          r !== null &&
          typeof r.offset === "number" &&
          typeof r.length === "number" &&
          typeof r.style === "string"
        );
      },
    )
    .map((item) => ({
      offset: item.offset,
      length: item.length,
      style: item.style,
    }));
}

function parseEntityRanges(
  value: unknown,
): ArticleContentBlock["entityRanges"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { offset: number; length: number; key: number } => {
        const r = asRecord(item);
        return (
          r !== null &&
          typeof r.offset === "number" &&
          typeof r.length === "number" &&
          typeof r.key === "number"
        );
      },
    )
    .map((item) => ({
      offset: item.offset,
      length: item.length,
      key: item.key,
    }));
}

function buildMediaIdToUrlMap(
  mediaEntities: UnknownRecord[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entity of mediaEntities) {
    const mediaId = asString(entity.media_id);
    const mediaInfo = asRecord(entity.media_info);
    const url = asString(mediaInfo?.original_img_url);
    if (mediaId && url) {
      map.set(mediaId, url);
    }
  }
  return map;
}

function resolveMediaEntityUrl(
  data: Record<string, unknown>,
  mediaUrlMap: Map<string, string>,
): string | null {
  const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
  for (const item of mediaItems) {
    const record = asRecord(item);
    if (!record) continue;
    const mediaId = asString(record.mediaId);
    if (mediaId && mediaUrlMap.has(mediaId)) {
      return mediaUrlMap.get(mediaId)!;
    }
  }
  return null;
}

function extractContentBlocks(
  contentState: UnknownRecord,
  mediaEntities?: UnknownRecord[],
): {
  blocks: ArticleContentBlock[];
  entityMap: Record<string, ArticleContentEntity>;
} | null {
  const rawBlocks = asRecords(contentState.blocks);
  if (rawBlocks.length === 0) return null;

  const blocks: ArticleContentBlock[] = rawBlocks.map((block) => ({
    type: asString(block.type) || "unstyled",
    text: asString(block.text) || "",
    inlineStyleRanges: parseInlineStyleRanges(block.inlineStyleRanges),
    entityRanges: parseEntityRanges(block.entityRanges),
    depth: typeof block.depth === "number" ? block.depth : 0,
  }));

  const mediaUrlMap = mediaEntities
    ? buildMediaIdToUrlMap(mediaEntities)
    : new Map<string, string>();

  const entityMap: Record<string, ArticleContentEntity> = {};

  // entityMap can be either an object {0: {...}, 1: {...}}
  // or an array [{key: "0", value: {...}}, ...]
  const rawEntityMap = contentState.entityMap;
  if (Array.isArray(rawEntityMap)) {
    // Array format: [{key, value: {type, data, ...}}, ...]
    for (const item of rawEntityMap) {
      const entry = asRecord(item);
      if (!entry) continue;
      const key = asString(entry.key);
      const value = asRecord(entry.value);
      if (!key || !value) continue;
      const entityType = asString(value.type);
      if (!entityType) continue;
      let data = (asRecord(value.data) || {}) as Record<string, unknown>;
      // Resolve MEDIA entities to image URLs
      if (entityType === "MEDIA" && mediaUrlMap.size > 0) {
        const imageUrl = resolveMediaEntityUrl(data, mediaUrlMap);
        if (imageUrl) data = { ...data, imageUrl };
      }
      entityMap[key] = { type: entityType, data };
    }
  } else {
    const objMap = asRecord(rawEntityMap);
    if (objMap) {
      for (const [key, val] of Object.entries(objMap)) {
        const entity = asRecord(val);
        if (!entity) continue;
        const entityType = asString(entity.type);
        if (!entityType) continue;
        let data = (asRecord(entity.data) || {}) as Record<string, unknown>;
        if (entityType === "MEDIA" && mediaUrlMap.size > 0) {
          const imageUrl = resolveMediaEntityUrl(data, mediaUrlMap);
          if (imageUrl) data = { ...data, imageUrl };
        }
        entityMap[key] = { type: entityType, data };
      }
    }
  }

  return { blocks, entityMap };
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
  const candidates = [
    asString(coverMediaInfo?.original_img_url),
    asString(directMediaInfo?.original_img_url),
    asString(node.original_img_url),
    asString(node.image_url),
    asString(imageRecord?.url),
    asString(node.media_url_https),
    asString(node.media_url),
  ].filter((value): value is string => Boolean(value && !isLikelyProfileImageUrl(value)));

  return pickLongest(candidates);
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
  let bestBlocks: ArticleContentBlock[] | null = null;
  let bestEntityMap: Record<string, ArticleContentEntity> | null = null;

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

    // Extract structured content blocks from content_state
    const contentState = asRecord(node.content_state);
    if (isLikelyArticleNode && contentState) {
      const mediaEntities = asRecords(node.media_entities);
      const parsed = extractContentBlocks(contentState, mediaEntities);
      if (parsed && (!bestBlocks || parsed.blocks.length > bestBlocks.length)) {
        bestBlocks = parsed.blocks;
        bestEntityMap = parsed.entityMap;
      }
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

  if (best && bestBlocks && bestBlocks.length > 0) {
    best.contentBlocks = bestBlocks;
    best.entityMap = bestEntityMap || {};
  }

  return best;
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

  const articleFallback =
    pickLongest([article?.title || null, article?.plainText || null]).trim();

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

function parseEmbeddedTweet(result: UnknownRecord | null): Bookmark["quotedTweet"] {
  const embedded = unwrapTweet(result);
  if (!embedded) return null;

  const legacy = asRecord(embedded.legacy);
  const core = asRecord(embedded.core);
  if (!legacy || !core) return null;

  const author = parseAuthor(core);
  if (!author) return null;

  const { text, urls } = parseTweetText(embedded, legacy);
  const tweetId = asString(legacy.id_str) || asString(embedded.rest_id) || "";
  if (!tweetId) return null;

  return {
    tweetId,
    text,
    createdAt: toTimestamp(legacy.created_at),
    author,
    media: parseMedia(legacy),
    urls,
    article: extractArticle(embedded),
  };
}

function parseQuotedTweet(tweet: UnknownRecord): Bookmark["quotedTweet"] {
  const quotedResult = asRecord(asRecord(tweet.quoted_status_result)?.result);
  return parseEmbeddedTweet(quotedResult);
}

function parseRetweetedTweet(tweet: UnknownRecord): Bookmark["quotedTweet"] {
  const directRetweet = asRecord(asRecord(tweet.retweeted_status_result)?.result);
  if (directRetweet) {
    return parseEmbeddedTweet(directRetweet);
  }

  const legacy = asRecord(tweet.legacy);
  const legacyRetweet = asRecord(
    asRecord(legacy?.retweeted_status_result)?.result,
  );
  if (legacyRetweet) {
    return parseEmbeddedTweet(legacyRetweet);
  }

  return null;
}

function resolveTweetKind(input: {
  retweetedTweet: Bookmark["quotedTweet"];
  isThread: boolean;
  inReplyToTweetId?: string;
  quotedTweet: Bookmark["quotedTweet"];
  article: ArticleContent | null;
}): TweetKind {
  if (input.retweetedTweet) return "repost";
  if (input.isThread) return "thread";
  if (input.inReplyToTweetId) return "reply";
  if (input.quotedTweet) return "quote";
  if (input.article?.plainText.trim()) return "article";
  return "tweet";
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
    const quotedTweet = parseQuotedTweet(tweet);
    const retweetedTweet = parseRetweetedTweet(tweet);
    const article = extractArticle(tweet);
    const inReplyToTweetId = asString(legacy.in_reply_to_status_id_str) || undefined;
    const inReplyToScreenName = asString(legacy.in_reply_to_screen_name) || undefined;
    const isThread = Boolean(asRecord(legacy.self_thread));
    const tweetKind = resolveTweetKind({
      retweetedTweet,
      isThread,
      inReplyToTweetId,
      quotedTweet,
      article: article || { plainText: "" },
    });

    const displayText =
      retweetedTweet && /^RT\s+@\w+:/i.test(text) ? retweetedTweet.text : text;

    const tweetId = asString(legacy.id_str) || asString(tweet.rest_id) || "";
    if (!tweetId) return null;

    const bookmark: Bookmark = {
      id: tweetId,
      tweetId,
      text: displayText,
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
      isThread,
      hasImage: media.some((item) => item.type === "photo"),
      hasVideo: media.some(
        (item) => item.type === "video" || item.type === "animated_gif",
      ),
      hasLink: urls.length > 0,
      isLongText,
      quotedTweet,
      retweetedTweet,
      article,
      tweetKind,
      inReplyToTweetId,
      inReplyToScreenName,
    };

    return {
      bookmark,
      conversationId: asString(legacy.conversation_id_str) || tweetId,
    };
  } catch {
    return null;
  }
}

export interface BookmarkPageResult {
  bookmarks: Bookmark[];
  cursor: string | null;
}

export function parseBookmarkPagePayload(payload: unknown): BookmarkPageResult {
  const timeline = asRecord(
    asRecord(asRecord(payload)?.data)?.bookmark_timeline_v2,
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

  const tweetDisplayType = asString(itemContent.tweetDisplayType) || "Tweet";
  const bookmark: Bookmark = {
    ...parsed.bookmark,
    tweetDisplayType,
    isThread:
      parsed.bookmark.isThread || tweetDisplayType === "SelfThread",
    tweetKind:
      tweetDisplayType === "SelfThread" &&
      parsed.bookmark.tweetKind !== "repost"
        ? "thread"
        : parsed.bookmark.tweetKind,
  };

  return {
    bookmark,
    conversationId: parsed.conversationId,
    tweetDisplayType,
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
    quotedTweet: bookmark.quotedTweet || null,
    retweetedTweet: bookmark.retweetedTweet || null,
    tweetKind: bookmark.tweetKind,
    tweetDisplayType: bookmark.tweetDisplayType,
    inReplyToTweetId: bookmark.inReplyToTweetId,
    inReplyToScreenName: bookmark.inReplyToScreenName,
    isThread: bookmark.isThread,
  };
}

export function parseTweetDetailPayload(
  payload: unknown,
  tweetId: string,
): TweetDetailContent {
  const responseData = asRecord(payload);
  const directTweetResult = asRecord(
    asRecord(asRecord(responseData?.data)?.tweetResult)?.result,
  );
  const timelineTweets = parseDetailTimelineTweets(payload);
  if (timelineTweets.length === 0) {
    if (directTweetResult) {
      const parsed = parseTweetRecord(directTweetResult);
      if (parsed) {
        return { focalTweet: parsed.bookmark, thread: [] };
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
  return detail;
}
