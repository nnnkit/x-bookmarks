import { useEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "../types";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import { compactPreview } from "../lib/text";

interface Props {
  continueReadingItems: ContinueReadingItem[];
  unreadBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onBack: () => void;
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pickTitle(bookmark: Bookmark): string {
  const articleTitle = bookmark.article?.title?.trim();
  if (articleTitle) return articleTitle;
  return compactPreview(toSingleLine(bookmark.text), 92);
}

function estimateReadingMinutes(bookmark: Bookmark): number {
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
    const articleWords =
      articleText.length === 0 ? 0 : articleText.split(" ").length;
    estimate = Math.max(estimate, Math.ceil(articleWords / 200), 2);
  }
  if (bookmark.isLongText || bookmark.hasLink) {
    estimate = Math.max(estimate, 2);
  }

  return Math.max(1, estimate);
}

function inferKindBadge(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";
  if (bookmark.isLongText) return "Long post";
  if (bookmark.hasLink) return "Link";
  return "Post";
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes <= 0) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ReadingView({
  continueReadingItems,
  unreadBookmarks,
  onOpenBookmark,
  onBack,
}: Props) {
  const containerWidthClass = "max-w-3xl";
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const inProgress = continueReadingItems.filter(
    (item) => !item.progress.completed,
  );
  const completed = continueReadingItems.filter(
    (item) => item.progress.completed,
  );

  const allBookmarks = useMemo(
    () => [
      ...inProgress.map((item) => item.bookmark),
      ...completed.map((item) => item.bookmark),
      ...unreadBookmarks,
    ],
    [inProgress, completed, unreadBookmarks],
  );

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < itemRefs.current.length) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < allBookmarks.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (
        (e.key === "Enter" || e.key === "o") &&
        focusedIndex >= 0 &&
        focusedIndex < allBookmarks.length
      ) {
        onOpenBookmark(allBookmarks[focusedIndex]);
      } else if (e.key === "Escape") {
        onBack();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, allBookmarks, onOpenBookmark, onBack]);

  let itemIndex = 0;

  return (
    <div className="min-h-dvh bg-x-bg">
      <div className="sticky top-0 z-10 border-b border-x-border bg-x-bg/80 backdrop-blur-md">
        <div
          className={`mx-auto flex items-center gap-3 px-4 py-3 ${containerWidthClass}`}
        >
          <button
            onClick={onBack}
            aria-label="Back to home"
            className="rounded-full p-2 text-x-text transition-colors hover:bg-x-hover"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-x-text">Reading</span>
        </div>
      </div>

      <main className={`${containerWidthClass} mx-auto px-4 pb-16 pt-6`}>
        {inProgress.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-x-text-secondary">
              Continue Reading
            </h2>
            <div className="space-y-2">
              {inProgress.map(({ bookmark, progress }) => {
                const idx = itemIndex++;
                return (
                <button
                  key={bookmark.tweetId}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  type="button"
                  onClick={() => onOpenBookmark(bookmark)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-x-hover ${focusedIndex === idx ? "border-x-blue ring-2 ring-x-blue/40 bg-x-hover" : "border-x-border bg-x-card"}`}
                >
                  <img
                    src={bookmark.author.profileImageUrl}
                    alt=""
                    className="size-10 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-x-text">
                      {pickTitle(bookmark)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-x-border">
                        <div
                          className="h-full rounded-full bg-x-blue transition-all"
                          style={{ width: `${progress.scrollPercent}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-x-text-secondary">
                        {progress.scrollPercent}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-x-text-secondary">
                      @{bookmark.author.screenName} &middot;{" "}
                      {formatTimeAgo(progress.lastReadAt)}
                    </p>
                  </div>
                </button>
                );
              })}
            </div>
          </section>
        )}

        {completed.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-x-text-secondary">
              Completed
            </h2>
            <div className="space-y-2">
              {completed.map(({ bookmark, progress }) => {
                const idx = itemIndex++;
                return (
                <button
                  key={bookmark.tweetId}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  type="button"
                  onClick={() => onOpenBookmark(bookmark)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${focusedIndex === idx ? "border-x-blue ring-2 ring-x-blue/40 bg-x-hover opacity-100" : "border-x-border bg-x-card opacity-70 hover:bg-x-hover hover:opacity-100"}`}
                >
                  <img
                    src={bookmark.author.profileImageUrl}
                    alt=""
                    className="size-10 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-x-text">
                      {pickTitle(bookmark)}
                    </p>
                    <p className="mt-1 text-xs text-x-text-secondary">
                      <span className="text-x-success">Done</span> &middot; @
                      {bookmark.author.screenName} &middot;{" "}
                      {formatTimeAgo(progress.lastReadAt)}
                    </p>
                  </div>
                </button>
                );
              })}
            </div>
          </section>
        )}

        {unreadBookmarks.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-x-text-secondary">
              Unread
            </h2>
            <div className="space-y-2">
              {unreadBookmarks.map((bookmark) => {
                const idx = itemIndex++;
                return (
                <button
                  key={bookmark.tweetId}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  type="button"
                  onClick={() => onOpenBookmark(bookmark)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-x-hover ${focusedIndex === idx ? "border-x-blue ring-2 ring-x-blue/40 bg-x-hover" : "border-x-border bg-x-card"}`}
                >
                  <img
                    src={bookmark.author.profileImageUrl}
                    alt=""
                    className="size-10 shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-x-text">
                      {pickTitle(bookmark)}
                    </p>
                    <p className="mt-1 text-xs text-x-text-secondary">
                      @{bookmark.author.screenName} &middot;{" "}
                      {estimateReadingMinutes(bookmark)} min read &middot;{" "}
                      <span className="rounded bg-x-border/50 px-1.5 py-0.5 text-[10px] uppercase">
                        {inferKindBadge(bookmark)}
                      </span>
                    </p>
                  </div>
                </button>
                );
              })}
            </div>
          </section>
        )}

        {continueReadingItems.length === 0 &&
          unreadBookmarks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg
                viewBox="0 0 24 24"
                className="mb-4 size-12 text-x-text-secondary"
                fill="currentColor"
              >
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" />
              </svg>
              <p className="text-x-text-secondary text-lg">
                Nothing here yet. Start reading a bookmark and your progress
                will appear here.
              </p>
            </div>
          )}
      </main>
    </div>
  );
}
