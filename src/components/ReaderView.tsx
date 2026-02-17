import { useEffect, useMemo, useState } from "react";
import type { Bookmark } from "../types";
import { fetchTweetDetail } from "../api/twitter";
import type { ThemePreference } from "../hooks/useTheme";

import { resolveTweetKind } from "./reader/utils";
import { TweetRenderer } from "./reader/TweetRenderer";

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

interface ReaderViewProps {
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
}: ReaderViewProps) {
  const [resolvedBookmark, setResolvedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setResolvedBookmark(null);
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [bookmark.tweetId]);

  const displayBookmark = resolvedBookmark || bookmark;
  const displayKind = useMemo(
    () => resolveTweetKind(displayBookmark),
    [displayBookmark],
  );

  const containerWidthClass = "max-w-3xl";

  return (
    <div className="min-h-dvh bg-x-bg">
      {/* Sticky header */}
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
              className="rounded-full border border-x-border bg-x-card px-3 py-1.5 text-xs text-x-text-secondary transition-colors hover:text-x-text"
              title="Theme (Auto follows browser and syncs)"
            >
              {themeLabel(themePreference)}
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
                <path d="M5.5 3h13A1.5 1.5 0 0120 4.5v17.72l-8-4.62-8 4.62V4.5A1.5 1.5 0 015.5 3zm0 1a.5.5 0 00-.5.5v15.99l7-4.04 7 4.04V4.5a.5.5 0 00-.5-.5h-13z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <article className={`${containerWidthClass} mx-auto px-5 pb-16 pt-6`}>
        <TweetRenderer
          displayBookmark={displayBookmark}
          displayKind={displayKind}
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
