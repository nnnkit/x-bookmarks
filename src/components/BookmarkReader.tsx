import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  Monitor,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import type { Bookmark, Highlight, ThreadTweet } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { fetchTweetDetail } from "../api/core/posts";
import { cn } from "../lib/cn";

import { resolveTweetKind } from "./reader/utils";
import { TweetContent } from "./reader/TweetContent";
import { SelectionToolbar } from "./reader/SelectionToolbar";
import { HighlightPopover } from "./reader/HighlightPopover";
import { useReadingProgress } from "../hooks/useReadingProgress";
import { useSelectionToolbar } from "../hooks/useSelectionToolbar";
import { useHighlights } from "../hooks/useHighlights";

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
  const articleRef = useRef<HTMLElement>(null);
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

  const { addHighlight, removeHighlight, updateHighlightNote, getHighlight } =
    useHighlights({
      tweetId: bookmark.tweetId,
      contentReady: !detailLoading,
      containerRef: articleRef,
    });

  const { toolbarState, dismiss: dismissToolbar } =
    useSelectionToolbar(articleRef);

  const [popoverState, setPopoverState] = useState<{
    highlight: Highlight;
    position: { x: number; y: number };
  } | null>(null);

  const handleArticleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      const mark = target.closest("mark.xbt-highlight") as HTMLElement | null;
      const star = target.closest(".xbt-note-star") as HTMLElement | null;

      const el = star || mark;
      if (!el) return;

      const highlightId = el.dataset.highlightId;
      if (!highlightId) return;

      const highlight = getHighlight(highlightId);
      if (!highlight) return;

      const rect = el.getBoundingClientRect();
      setPopoverState({
        highlight,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.bottom,
        },
      });
    },
    [getHighlight],
  );

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
            title="Back"
            className="rounded-lg p-2 text-x-text transition-colors hover:bg-x-hover"
          >
            <ArrowLeft className="size-5" />
          </button>

          <span className="text-lg font-semibold text-x-text">Post</span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={cycleTheme}
              aria-label={`Theme: ${themePreference}`}
              title={`Theme: ${themePreference}`}
              className="rounded-lg p-2 text-x-text-secondary transition-colors hover:text-x-text hover:bg-x-hover"
            >
              {themePreference === "light" ? (
                <Sun className="size-5" />
              ) : themePreference === "dark" ? (
                <Moon className="size-5" />
              ) : (
                <Monitor className="size-5" />
              )}
            </button>

            <button
              onClick={onUnbookmark}
              aria-label="Remove bookmark"
              title="Remove bookmark"
              className="rounded-lg p-2 text-x-text-secondary transition-colors hover:text-red-500 hover:bg-red-500/10"
            >
              <BookmarkSimple weight="fill" className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {onPrev && (
        <button
          onClick={onPrev}
          aria-label="Previous post"
          title="Previous"
          className="fixed left-4 top-1/2 z-20 -translate-y-1/2 rounded-lg bg-x-bg/80 p-3 text-x-text-secondary shadow-md border border-x-border backdrop-blur-sm transition-colors hover:bg-x-hover hover:text-x-text"
        >
          <CaretLeft className="size-5" />
        </button>
      )}

      {onNext && (
        <button
          onClick={onNext}
          aria-label="Next post"
          title="Next"
          className="fixed right-4 top-1/2 z-20 -translate-y-1/2 rounded-lg bg-x-bg/80 p-3 text-x-text-secondary shadow-md border border-x-border backdrop-blur-sm transition-colors hover:bg-x-hover hover:text-x-text"
        >
          <CaretRight className="size-5" />
        </button>
      )}

      <article
        ref={articleRef}
        className={cn(containerWidthClass, "relative mx-auto px-5 pb-16 pt-6")}
        onClick={handleArticleClick}
      >
        <TweetContent
          displayBookmark={displayBookmark}
          displayKind={displayKind}
          detailThread={detailThread}
          detailLoading={detailLoading}
          detailError={detailError}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={onOpenBookmark}
          onShuffle={onShuffle}
          tweetSectionIdPrefix="section-tweet"
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

      {toolbarState && (
        <SelectionToolbar
          position={toolbarState.position}
          ranges={toolbarState.ranges}
          onHighlight={(ranges, note) => {
            addHighlight(ranges, note);
            dismissToolbar();
          }}
          onDismiss={dismissToolbar}
        />
      )}

      {popoverState && (
        <HighlightPopover
          highlight={popoverState.highlight}
          position={popoverState.position}
          onDelete={(id) => {
            removeHighlight(id);
            setPopoverState(null);
          }}
          onUpdateNote={(id, note) => {
            updateHighlightNote(id, note);
            setPopoverState(null);
          }}
          onDismiss={() => setPopoverState(null)}
        />
      )}
    </div>
  );
}
