import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "../types";
import { timeAgo } from "../lib/time";

interface BookmarkFilmstripProps {
  bookmarks: Bookmark[];
  stackSize: number;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onOpenLibrary: () => void;
  onSync: () => void;
  syncing: boolean;
}

function previewText(value: string, max = 140): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}...`;
}

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD = 50;

export function BookmarkFilmstrip({
  bookmarks,
  stackSize,
  onOpenBookmark,
  onOpenLibrary,
  onSync,
  syncing,
}: BookmarkFilmstripProps) {
  const topBookmarks = useMemo(
    () => bookmarks.slice(0, stackSize),
    [bookmarks, stackSize],
  );
  const total = topBookmarks.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const startXRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (total === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((prev) => prev % total);
  }, [total]);

  // Auto-advance
  useEffect(() => {
    if (total < 2 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [total, paused]);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % total) + total) % total);
      setPaused(true);
      // Resume auto-advance after 10s of inactivity
      const timeout = window.setTimeout(() => setPaused(false), 10000);
      return () => window.clearTimeout(timeout);
    },
    [total],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setDragging(true);
    setDragX(0);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragX(e.clientX - startXRef.current);
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);

    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      if (dragX < 0) {
        goTo(activeIndex + 1);
      } else {
        goTo(activeIndex - 1);
      }
    }
    setDragX(0);
  }, [dragging, dragX, activeIndex, goTo]);

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-x-border bg-x-card/80 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-balance">Bookmarks</h2>
          <span className="text-xs text-x-text-secondary">Filmstrip</span>
        </div>
        <p className="text-sm text-x-text-secondary text-pretty mb-5">
          Your bookmarks appear here after the first sync.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="px-4 py-2 rounded-full bg-x-blue text-white text-sm font-semibold hover:bg-x-blue/90 transition-colors disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync bookmarks"}
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="px-4 py-2 rounded-full border border-x-border text-sm text-x-text-secondary hover:text-x-text hover:bg-x-hover transition-colors"
          >
            Open library
          </button>
        </div>
      </section>
    );
  }

  // Progress: fraction of total time elapsed through items
  const progress = ((activeIndex + 1) / total) * 100;

  return (
    <section className="rounded-3xl border border-x-border bg-x-card/80 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-balance">Bookmarks</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous bookmark"
            className="p-1.5 rounded-full text-x-text-secondary hover:text-x-blue hover:bg-x-hover transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M15.71 6.29a1 1 0 010 1.42L11.41 12l4.3 4.29a1 1 0 11-1.42 1.42l-5-5a1 1 0 010-1.42l5-5a1 1 0 011.42 0z" />
            </svg>
          </button>
          <span className="text-xs text-x-text-secondary tabular-nums min-w-[2.5rem] text-center">
            {activeIndex + 1}/{total}
          </span>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next bookmark"
            className="p-1.5 rounded-full text-x-text-secondary hover:text-x-blue hover:bg-x-hover transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M8.29 17.71a1 1 0 010-1.42L12.59 12 8.29 7.71a1 1 0 111.42-1.42l5 5a1 1 0 010 1.42l-5 5a1 1 0 01-1.42 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filmstrip track */}
      <div
        className="overflow-hidden rounded-2xl select-none touch-pan-y"
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className={`flex ${
            dragging
              ? ""
              : "transition-transform duration-400 ease-out"
          }`}
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${dragX}px))`,
          }}
        >
          {topBookmarks.map((bookmark) => {
            const media = bookmark.media.find(
              (item) => item.type === "photo",
            );

            return (
              <div
                key={bookmark.tweetId}
                className="w-full shrink-0 cursor-pointer"
                onClick={() => {
                  if (!dragging && Math.abs(dragX) < 5) {
                    onOpenBookmark(bookmark);
                  }
                }}
              >
                <div className="rounded-2xl border border-x-border bg-x-bg p-4 mx-0.5">
                  {/* Media strip at top */}
                  {media && (
                    <img
                      src={media.url}
                      alt=""
                      className="w-full h-28 rounded-xl object-cover mb-3"
                      loading="lazy"
                      draggable={false}
                    />
                  )}

                  <div className="flex items-center gap-2 mb-2.5">
                    <img
                      src={bookmark.author.profileImageUrl}
                      alt=""
                      className="size-7 rounded-full"
                      loading="lazy"
                      draggable={false}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {bookmark.author.name}
                      </p>
                      <p className="text-xs text-x-text-secondary truncate">
                        @{bookmark.author.screenName} ·{" "}
                        {timeAgo(bookmark.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-pretty line-clamp-4">
                    {previewText(bookmark.text)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 rounded-full bg-x-border overflow-hidden">
        <div
          className="h-full bg-x-blue rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        type="button"
        onClick={onOpenLibrary}
        className="mt-4 w-full rounded-full border border-x-border px-4 py-2 text-sm text-x-text-secondary hover:text-x-text hover:bg-x-hover transition-colors"
      >
        Open full bookmarks library
      </button>
    </section>
  );
}
