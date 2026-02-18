import type { ArticleContentBlock } from "../../types";
import type { ReaderTweet } from "./types";
import type { TweetKind } from "../../types";
export { formatNumber } from "../../lib/format";
export { compactPreview, normalizeText, truncateLabel } from "../../lib/text";

export const baseTweetTextClass =
  "break-words [&_a]:text-x-blue [&_a:hover]:underline";

function sanitizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

const URL_REGEX = /https?:\/\/[^\s<]+/g;
const URL_TOKEN_REGEX = /__URL_TOKEN_(\d+)__/g;
const MENTION_REGEX =
  /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,15})(?=$|[^A-Za-z0-9_])/g;
const HASHTAG_REGEX =
  /(^|[^A-Za-z0-9_])#([A-Za-z0-9_]+)(?=$|[^A-Za-z0-9_])/g;

export function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function textClassForMode(
  compact = false,
): string {
  return `${baseTweetTextClass} text-x-text ${compact ? "text-[0.99rem] leading-7" : "text-[1.04rem] leading-8"}`;
}

export function kindPillClass(kind: TweetKind): string {
  if (kind === "repost")
    return "bg-green-500/12 text-green-300 border-green-500/30";
  if (kind === "reply") return "bg-x-blue/12 text-x-blue border-x-blue/40";
  if (kind === "thread")
    return "bg-amber-500/12 text-amber-300 border-amber-500/30";
  if (kind === "quote")
    return "bg-cyan-500/12 text-cyan-300 border-cyan-500/30";
  if (kind === "article")
    return "bg-orange-500/12 text-orange-300 border-orange-500/30";
  return "bg-x-link-card text-x-text-secondary border-x-border";
}

export function resolveTweetKind(tweet: ReaderTweet): TweetKind {
  if (tweet.tweetKind) return tweet.tweetKind;
  if (tweet.retweetedTweet) return "repost";
  if (tweet.isThread || tweet.tweetDisplayType === "SelfThread") return "thread";
  if (tweet.inReplyToTweetId) return "reply";
  if (tweet.quotedTweet) return "quote";
  if (tweet.article?.plainText?.trim()) return "article";
  return "tweet";
}

export type BlockGroup =
  | { type: "unordered-list"; items: ArticleContentBlock[] }
  | { type: "ordered-list"; items: ArticleContentBlock[] }
  | { type: "single"; block: ArticleContentBlock };

export function groupBlocks(blocks: ArticleContentBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];

  for (const block of blocks) {
    if (block.type === "unordered-list-item") {
      const last = groups[groups.length - 1];
      if (last?.type === "unordered-list") {
        last.items.push(block);
      } else {
        groups.push({ type: "unordered-list", items: [block] });
      }
    } else if (block.type === "ordered-list-item") {
      const last = groups[groups.length - 1];
      if (last?.type === "ordered-list") {
        last.items.push(block);
      } else {
        groups.push({ type: "ordered-list", items: [block] });
      }
    } else {
      groups.push({ type: "single", block });
    }
  }

  return groups;
}

export function detectArticleHeadings(
  plainText: string,
): { index: number; text: string }[] {
  const lines = plainText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headings: { index: number; text: string }[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (
      line.length < 80 &&
      line.length > 2 &&
      !/[.!?,;:]$/.test(line) &&
      nextLine.length > line.length
    ) {
      headings.push({ index: i, text: line });
    }
  }

  return headings;
}

export function renderBlockInlineContent(
  block: ArticleContentBlock,
  entityMap: Record<string, import("../../types").ArticleContentEntity>,
): string {
  const { text, inlineStyleRanges, entityRanges } = block;
  if (!text) return "";

  const length = text.length;
  const bold = new Uint8Array(length);
  const italic = new Uint8Array(length);
  const entityKey: (number | -1)[] = new Array(length).fill(-1);

  for (const range of inlineStyleRanges) {
    const end = Math.min(range.offset + range.length, length);
    const style = range.style.toUpperCase();
    for (let i = range.offset; i < end; i++) {
      if (style === "BOLD") bold[i] = 1;
      if (style === "ITALIC") italic[i] = 1;
    }
  }

  for (const range of entityRanges) {
    const end = Math.min(range.offset + range.length, length);
    for (let i = range.offset; i < end; i++) {
      entityKey[i] = range.key;
    }
  }

  type Segment = {
    text: string;
    bold: boolean;
    italic: boolean;
    entityKey: number;
  };
  const segments: Segment[] = [];

  for (let i = 0; i < length; i++) {
    const seg: Segment = {
      text: text[i],
      bold: bold[i] === 1,
      italic: italic[i] === 1,
      entityKey: entityKey[i],
    };
    const last = segments[segments.length - 1];
    if (
      last &&
      last.bold === seg.bold &&
      last.italic === seg.italic &&
      last.entityKey === seg.entityKey
    ) {
      last.text += seg.text;
    } else {
      segments.push(seg);
    }
  }

  return segments
    .map((seg) => {
      let html = escapeHtml(seg.text);
      if (seg.entityKey < 0) {
        html = linkifyMentionsAndTags(html);
      }
      if (seg.bold) html = `<strong>${html}</strong>`;
      if (seg.italic) html = `<em>${html}</em>`;
      if (seg.entityKey >= 0) {
        const entity = entityMap[String(seg.entityKey)];
        if (entity?.type === "LINK") {
          const url = sanitizeUrl(String(entity.data?.url || ""));
          if (url) {
            html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
          }
        }
      }
      return html;
    })
    .join("");
}

function linkifyMentionsAndTags(text: string): string {
  const withMentions = text.replace(
    MENTION_REGEX,
    (_match, prefix: string, handle: string) =>
      `${prefix}<a href="https://x.com/${handle}" target="_blank" rel="noopener noreferrer">@${handle}</a>`,
  );

  return withMentions.replace(
    HASHTAG_REGEX,
    (_match, prefix: string, tag: string) =>
      `${prefix}<a href="https://x.com/hashtag/${tag}" target="_blank" rel="noopener noreferrer">#${tag}</a>`,
  );
}

export function linkifyText(text: string): string {
  if (!text) return "";

  const escaped = escapeHtml(text);
  const urlTokens: string[] = [];

  const withUrlTokens = escaped.replace(URL_REGEX, (url) => {
    const token = `__URL_TOKEN_${urlTokens.length}__`;
    urlTokens.push(
      `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    );
    return token;
  });

  const withSocialLinks = linkifyMentionsAndTags(withUrlTokens);

  return withSocialLinks.replace(
    URL_TOKEN_REGEX,
    (_match, tokenIndex: string) => {
      const index = Number(tokenIndex);
      return Number.isFinite(index) ? urlTokens[index] || "" : "";
    },
  );
}

export function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) return [text.trim()].filter(Boolean);
  return matches.map((chunk) => chunk.trim()).filter(Boolean);
}

export function paragraphizeText(
  raw: string,
  style: "tweet" | "article",
): string[] {
  const input = raw.replace(/\r\n/g, "\n").trim();
  if (!input) return [];

  if (/\n{2,}/.test(input)) {
    return input
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  if (style === "tweet") {
    const lines = input
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [input];
  }

  let prepared = input;
  prepared = prepared.replace(/\s*[•●▪︎]\s*/g, "\n\n• ");
  prepared = prepared.replace(/\s(?=\d+\.\s)/g, "\n");
  prepared = prepared.replace(/([.!?])\s+(?=[A-Z0-9""])/g, "$1\n");

  const lines = prepared
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const grouped: string[] = [];
  let current = "";
  for (const line of lines) {
    const candidate = current ? `${current} ${line}` : line;
    if (candidate.length > 260) {
      if (current) grouped.push(current);
      current = line;
      continue;
    }
    current = candidate;
  }
  if (current) grouped.push(current);

  if (grouped.length > 1) return grouped;

  if (input.length < 420) return [input];

  const sentences = splitSentences(input);
  if (sentences.length <= 2) return [input];

  const paragraphs: string[] = [];
  let paragraph = "";
  for (const sentence of sentences) {
    const candidate = paragraph ? `${paragraph} ${sentence}` : sentence;
    if (candidate.length > 290) {
      if (paragraph) paragraphs.push(paragraph);
      paragraph = sentence;
      continue;
    }
    paragraph = candidate;
  }
  if (paragraph) paragraphs.push(paragraph);

  return paragraphs.length > 0 ? paragraphs : [input];
}

export function paragraphHtml(text: string): string {
  return linkifyText(text).replace(/\n/g, "<br />");
}

export function toEmbeddedReaderTweet(
  tweet: NonNullable<import("../../types").Bookmark["retweetedTweet"]>,
): ReaderTweet {
  return {
    text: tweet.text,
    author: tweet.author,
    media: tweet.media,
    urls: tweet.urls || [],
    article: tweet.article || null,
    quotedTweet: null,
    retweetedTweet: null,
  };
}
