import { useEffect, useMemo, useState } from "react";
import type { Bookmark } from "../types";
import { timeAgo } from "../lib/time";

interface BookmarkStackProps {
  bookmarks: Bookmark[];
  stackSize: number;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onOpenLibrary: () => void;
  onSync: () => void;
  syncing: boolean;
}

function previewText(value: string, max = 170): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}...`;
}

export function BookmarkStack({
  bookmarks,
  stackSize,
  onOpenBookmark,
  onOpenLibrary,
  onSync,
  syncing,
}: BookmarkStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const topBookmarks = useMemo(() => bookmarks.slice(0, stackSize), [bookmarks, stackSize]);
  const total = topBookmarks.length;

  useEffect(() => {
    if (total === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((prev) => prev % total);
  }, [total]);

  useEffect(() => {
    if (total < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [total]);

  const movePrev = () => {
    if (total < 2) return;
    setActiveIndex((prev) => (prev - 1 + total) % total);
  };

  const moveNext = () => {
    if (total < 2) return;
    setActiveIndex((prev) => (prev + 1) % total);
  };

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-x-border bg-x-card/80 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-balance">Bookmarks Stack</h2>
          <span className="text-xs text-x-text-secondary">Top {stackSize}</span>
        </div>
        <p className="text-sm text-x-text-secondary text-pretty mb-5">
          Your stack appears here after the first sync.
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

  const stacked = topBookmarks
    .map((bookmark, index) => ({
      bookmark,
      delta: (index - activeIndex + total) % total,
      isActive: index === activeIndex,
    }))
    .sort((a, b) => b.delta - a.delta);

  return (
    <section className="rounded-3xl border border-x-border bg-x-card/80 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-balance">Bookmarks Stack</h2>
        <span className="text-xs text-x-text-secondary tabular-nums">
          {total}/{stackSize}
        </span>
      </div>

      <div className="relative h-[19rem]">
        {stacked.map(({ bookmark, delta, isActive }) => {
          const translateY = delta * 14;
          const scale = 1 - delta * 0.035;
          const opacity = Math.max(0.25, 1 - delta * 0.17);
          const media = bookmark.media.find((item) => item.type === "photo");

          return (
            <button
              key={bookmark.tweetId}
              type="button"
              onClick={() => {
                if (isActive) {
                  onOpenBookmark(bookmark);
                  return;
                }
                setActiveIndex(topBookmarks.findIndex((b) => b.tweetId === bookmark.tweetId));
              }}
              className={`absolute inset-0 w-full rounded-2xl border border-x-border bg-x-bg p-4 text-left transition-[transform,opacity] duration-300 ease-out ${
                isActive ? "cursor-pointer" : "cursor-default"
              }`}
              style={{
                transform: `translateY(${translateY}px) scale(${scale})`,
                opacity,
                zIndex: 100 - delta,
              }}
              aria-label={`Bookmark by ${bookmark.author.name}`}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <img
                  src={bookmark.author.profileImageUrl}
                  alt=""
                  className="size-7 rounded-full"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{bookmark.author.name}</p>
                  <p className="text-xs text-x-text-secondary truncate">
                    @{bookmark.author.screenName} · {timeAgo(bookmark.createdAt)}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 text-pretty line-clamp-5">
                {previewText(bookmark.text)}
              </p>

              {media && (
                <img
                  src={media.url}
                  alt=""
                  className="mt-3 h-24 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {topBookmarks.map((bookmark, index) => (
            <button
              key={bookmark.tweetId}
              type="button"
              aria-label={`Go to bookmark ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex
                  ? "w-5 bg-x-blue"
                  : "w-2.5 bg-x-border hover:bg-x-text-secondary"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={movePrev}
            aria-label="Previous bookmark"
            className="p-2 rounded-full border border-x-border text-x-text-secondary hover:text-x-blue hover:bg-x-hover transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M15.71 6.29a1 1 0 010 1.42L11.41 12l4.3 4.29a1 1 0 11-1.42 1.42l-5-5a1 1 0 010-1.42l5-5a1 1 0 011.42 0z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={moveNext}
            aria-label="Next bookmark"
            className="p-2 rounded-full border border-x-border text-x-text-secondary hover:text-x-blue hover:bg-x-hover transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M8.29 17.71a1 1 0 010-1.42L12.59 12 8.29 7.71a1 1 0 111.42-1.42l5 5a1 1 0 010 1.42l-5 5a1 1 0 01-1.42 0z" />
            </svg>
          </button>
        </div>
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
