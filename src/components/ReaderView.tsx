import { useEffect, useMemo, useState } from "react";
import type { Bookmark, ThreadTweet } from "../types";
import { fetchTweetDetail } from "../api/core/posts";
import type { ThemePreference } from "../hooks/useTheme";

import { resolveTweetKind } from "./reader/utils";
import { TweetRenderer } from "./reader/TweetRenderer";
import { useReadingProgress } from "../hooks/useReadingProgress";

function nextThemePreference(current: ThemePreference): ThemePreference {
  const order: ThemePreference[] = ["system", "light", "dark"];
  const index = order.indexOf(current);
  if (index < 0) return "system";
  return order[(index + 1) % order.length];
}

function themeLabel(value: ThemePreference): string {
  if (value === "system") return "Auto";
  if (value === "light") return "Light";
  return "Dark";
}

interface Props {
  bookmark: Bookmark;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  onBack: () => void;
  onUnbookmark: (tweetId: string) => void;
  unbookmarking: boolean;
  onShuffle?: () => void;
}

export function ReaderView({
  bookmark,
  relatedBookmarks,
  onOpenBookmark,
  themePreference,
  onThemePreferenceChange,
  onBack,
  onUnbookmark,
  unbookmarking,
  onShuffle,
}: Props) {
  const [resolvedBookmark, setResolvedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [detailThread, setDetailThread] = useState<ThreadTweet[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  useReadingProgress({
    tweetId: bookmark.tweetId,
    contentReady: !detailLoading,
  });

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

  const containerWidthClass = "max-w-3xl";

  return (
    <div className="min-h-dvh bg-x-bg">
      <div className="sticky top-0 z-10 border-b border-x-border bg-x-bg/80 backdrop-blur-md">
        <div
          className={`mx-auto flex items-center gap-3 px-4 py-3 ${containerWidthClass}`}
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

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onThemePreferenceChange(nextThemePreference(themePreference))
              }
              aria-label={`Theme: ${themeLabel(themePreference)}`}
              className="rounded-full p-2 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              title={`Switch to ${themeLabel(nextThemePreference(themePreference)).toLowerCase()}`}
            >
              {themePreference === "system" ? (
                <svg viewBox="0 0 256 256" className="size-5" fill="currentColor">
                  <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
                </svg>
              ) : themePreference === "light" ? (
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
              onClick={() => onUnbookmark(bookmark.tweetId)}
              disabled={unbookmarking}
              aria-label="Remove bookmark"
              className="rounded-full p-2 text-x-text-secondary transition-colors hover:bg-x-blue/10 hover:text-x-blue disabled:opacity-50"
              title="Remove bookmark"
            >
              <svg
                viewBox="0 0 24 24"
                className={`size-5 ${unbookmarking ? "animate-pulse" : ""}`}
                fill="currentColor"
              >
                <path d="M5.5 3h13A1.5 1.5 0 0120 4.5v17.72l-8-4.62-8 4.62V4.5A1.5 1.5 0 015.5 3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <article className={`${containerWidthClass} mx-auto px-5 pb-16 pt-6`}>
        <TweetRenderer
          displayBookmark={displayBookmark}
          displayKind={displayKind}
          detailThread={detailThread}
          detailLoading={detailLoading}
          detailError={detailError}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={onOpenBookmark}
          onShuffle={onShuffle}
        />
      </article>
    </div>
  );
}
