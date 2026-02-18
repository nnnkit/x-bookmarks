import { compactPreview } from "./text";
import type { Bookmark } from "../types";

const AI_REGEX = /\b(ai|llm|gpt|alignment|model)\b/;
const INDIE_REGEX = /\b(startup|indie|saas|founder|revenue|launch)\b/;
const ENGINEERING_REGEX = /\b(code|infra|engineering|database|performance)\b/;
const DESIGN_REGEX = /\b(design|ux|ui|product)\b/;

export function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function pickTitle(bookmark: Bookmark): string {
  const articleTitle = bookmark.article?.title?.trim();
  if (articleTitle) return articleTitle;
  return compactPreview(toSingleLine(bookmark.text), 92);
}

export function pickExcerpt(bookmark: Bookmark): string {
  const articleText = bookmark.article?.plainText?.trim();
  if (articleText) return compactPreview(articleText, 210);
  return compactPreview(toSingleLine(bookmark.text), 210);
}

export function estimateReadingMinutes(bookmark: Bookmark): number {
  const tweetText = toSingleLine(bookmark.text);
  const articleText = toSingleLine(bookmark.article?.plainText ?? "");
  const quoteText = toSingleLine(bookmark.quotedTweet?.text ?? "");
  const fullText = toSingleLine(`${tweetText} ${articleText} ${quoteText}`);
  const words = fullText.length === 0 ? 0 : fullText.split(" ").length;

  let estimate = Math.ceil(words / 180);

  if (bookmark.isThread || bookmark.tweetKind === "thread") {
    estimate = Math.max(estimate, 2);
  }
  if (bookmark.article?.plainText) {
    const articleWords = articleText.length === 0 ? 0 : articleText.split(" ").length;
    estimate = Math.max(estimate, Math.ceil(articleWords / 200), 2);
  }
  if (bookmark.isLongText || bookmark.hasLink) {
    estimate = Math.max(estimate, 2);
  }

  return Math.max(1, estimate);
}

export function hasReliableReadingTime(bookmark: Bookmark): boolean {
  const hasFullArticle =
    typeof bookmark.article?.plainText === "string" &&
    bookmark.article.plainText.trim().length > 0;

  if (hasFullArticle) return true;
  if (bookmark.isThread || bookmark.tweetKind === "thread") return false;
  if (bookmark.isLongText) return false;
  if (bookmark.hasLink) return false;
  return true;
}

export function inferCategory(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";

  const text = `${bookmark.text} ${bookmark.article?.title ?? ""}`.toLowerCase();
  if (AI_REGEX.test(text)) return "AI";
  if (INDIE_REGEX.test(text)) return "Indie";
  if (ENGINEERING_REGEX.test(text)) return "Engineering";
  if (DESIGN_REGEX.test(text)) return "Product";
  return "Reading";
}
