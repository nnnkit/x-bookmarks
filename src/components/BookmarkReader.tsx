import { useEffect, useMemo, useState } from "react";
import type { Bookmark, ThreadTweet } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { fetchTweetDetail } from "../api/core/posts";
import { cn } from "../lib/cn";

import { resolveTweetKind } from "./reader/utils";
import { TweetContent } from "./reader/TweetContent";
import { useReadingProgress } from "../hooks/useReadingProgress";

const THEME_CYCLE: ThemePreference[] = ["system", "light", "dark"];

interface Props {
  bookmark: Bookmark;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onBack: () => void;
  onShuffle?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onUnbookmark: () => void;
  themePreference: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
  onMarkAsRead?: (tweetId: string) => void;
  onMarkAsUnread?: (tweetId: string) => void;
}

export function BookmarkReader({
  bookmark,
  relatedBookmarks,
  onOpenBookmark,
  onBack,
  onShuffle,
  onPrev,
  onNext,
  onUnbookmark,
  themePreference,
  onThemeChange,
  onMarkAsRead,
  onMarkAsUnread,
}: Props) {
  const [readOverride, setReadOverride] = useState<boolean | null>(null);
  const [resolvedBookmark, setResolvedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [detailThread, setDetailThread] = useState<ThreadTweet[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const { isCompleted } = useReadingProgress({
    tweetId: bookmark.tweetId,
    contentReady: !detailLoading,
  });
  const effectiveMarkedRead = readOverride ?? isCompleted;

  useEffect(() => {
    let cancelled = false;

    setResolvedBookmark(null);
    setDetailThread([]);
    setDetailError(null);
    setDetailLoading(true);

    fetchTweetDetail(bookmark.tweetId)
      .then((detail) => {
        if (cancelled) return;

        if (detail.focalTweet) {
          setResolvedBookmark({
            ...detail.focalTweet,
            sortIndex: bookmark.sortIndex,
          });
        }

        if (detail.thread.length > 0) {
          setDetailThread(
            detail.thread.toSorted((a, b) => a.createdAt - b.createdAt),
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "DETAIL_ERROR");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookmark.tweetId, bookmark.sortIndex]);

  const displayBookmark = resolvedBookmark || bookmark;
  const displayKind = useMemo(
    () => resolveTweetKind(displayBookmark),
    [displayBookmark],
  );

  useEffect(() => {
    const title =
      displayBookmark.article?.title ||
      displayBookmark.text.slice(0, 80) ||
      "Post";
    document.title = title;
    return () => {
      document.title = "New Tab";
    };
  }, [displayBookmark.article?.title, displayBookmark.text]);

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(themePreference);
    onThemeChange(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const containerWidthClass = "max-w-3xl";

  return (
    <div className="min-h-dvh bg-x-bg">
      <div className="sticky top-0 z-10 border-b border-x-border bg-x-bg/80 backdrop-blur-md">
        <div
          className={cn("mx-auto flex items-center gap-3 px-4 py-3", containerWidthClass)}
        >
          <button
            onClick={onBack}
            aria-label="Back to bookmarks"
            className="rounded-full p-2 text-x-text transition-colors hover:bg-x-hover"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>

          <span className="text-lg font-semibold text-x-text">Post</span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={cycleTheme}
              aria-label={`Theme: ${themePreference}`}
              className="rounded-full p-2 text-x-text-secondary transition-colors hover:text-x-text hover:bg-x-hover"
            >
              {themePreference === "light" ? (
                <svg viewBox="0 0 256 256" className="size-5" fill="currentColor">
                  <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
                </svg>
              ) : themePreference === "dark" ? (
                <svg viewBox="0 0 256 256" className="size-5" fill="currentColor">
                  <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,128,232a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM128,216A88,88,0,0,1,65.76,65.76,89.1,89.1,0,0,1,100.36,40.73,104.12,104.12,0,0,0,215.27,155.64,89.1,89.1,0,0,1,190.24,190.24,87.39,87.39,0,0,1,128,216Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 256 256" className="size-5" fill="currentColor">
                  <path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z" />
                </svg>
              )}
            </button>

            <button
              onClick={onUnbookmark}
              aria-label="Remove bookmark"
              className="rounded-full p-2 text-x-text-secondary transition-colors hover:text-red-500 hover:bg-red-500/10"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                <path d="M4 4.523C4 3.125 5.028 2 6.3 2h11.4C18.972 2 20 3.125 20 4.523v17.2c0 .876-.534 1.373-1.074 1.373-.263 0-.534-.1-.796-.358L12 16.078l-6.13 6.66c-.263.259-.534.358-.797.358C4.534 23.096 4 22.6 4 21.722V4.523z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {onPrev && (
        <button
          onClick={onPrev}
          aria-label="Previous post"
          className="fixed left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-x-bg/80 p-3 text-x-text-secondary shadow-lg border border-x-border backdrop-blur-sm transition-all hover:bg-x-hover hover:text-x-text hover:scale-110"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
      )}

      {onNext && (
        <button
          onClick={onNext}
          aria-label="Next post"
          className="fixed right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-x-bg/80 p-3 text-x-text-secondary shadow-lg border border-x-border backdrop-blur-sm transition-all hover:bg-x-hover hover:text-x-text hover:scale-110"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>
      )}

      <article className={cn(containerWidthClass, "mx-auto px-5 pb-16 pt-6")}>
        <TweetContent
          displayBookmark={displayBookmark}
          displayKind={displayKind}
          detailThread={detailThread}
          detailLoading={detailLoading}
          detailError={detailError}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={onOpenBookmark}
          onShuffle={onShuffle}
          onToggleRead={onMarkAsRead ? () => {
            if (effectiveMarkedRead) {
              onMarkAsUnread?.(bookmark.tweetId);
              setReadOverride(false);
            } else {
              onMarkAsRead(bookmark.tweetId);
              setReadOverride(true);
            }
          } : undefined}
          isMarkedRead={effectiveMarkedRead}
        />
      </article>

    </div>
  );
}
