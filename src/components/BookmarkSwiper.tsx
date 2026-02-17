import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "../types";
import { timeAgo } from "../lib/time";

interface BookmarkSwiperProps {
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

const SWIPE_THRESHOLD = 100;
const ROTATION_FACTOR = 0.12;

export function BookmarkSwiper({
  bookmarks,
  stackSize,
  onOpenBookmark,
  onOpenLibrary,
  onSync,
  syncing,
}: BookmarkSwiperProps) {
  const topBookmarks = useMemo(
    () => bookmarks.slice(0, stackSize),
    [bookmarks, stackSize],
  );
  const total = topBookmarks.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<{
    direction: "left" | "right";
    index: number;
  } | null>(null);
  const startRef = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    if (total === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((prev) => prev % total);
  }, [total]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (total < 2) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      setDrag({ x: 0, y: 0, active: true });
    },
    [total],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.active) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setDrag({ x: dx, y: dy, active: true });
    },
    [drag.active],
  );

  const handlePointerUp = useCallback(() => {
    if (!drag.active) return;

    const velocity =
      Math.abs(drag.x) / Math.max(1, Date.now() - startRef.current.time);
    const shouldSwipe =
      Math.abs(drag.x) > SWIPE_THRESHOLD || velocity > 0.6;

    if (shouldSwipe) {
      const direction = drag.x > 0 ? "right" : "left";
      setExiting({ direction, index: activeIndex });
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % total);
        setExiting(null);
      }, 280);
    }

    setDrag({ x: 0, y: 0, active: false });
  }, [drag, activeIndex, total]);

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-x-border bg-x-card/80 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-balance">Bookmarks</h2>
          <span className="text-xs text-x-text-secondary">Swipe</span>
        </div>
        <p className="text-sm text-x-text-secondary text-pretty mb-5">
          Your cards appear here after the first sync.
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

  const visibleCards = topBookmarks
    .map((bookmark, index) => {
      const delta = (index - activeIndex + total) % total;
      return { bookmark, delta, index };
    })
    .filter(({ delta }) => delta < 4)
    .sort((a, b) => b.delta - a.delta);

  return (
    <section className="rounded-3xl border border-x-border bg-x-card/80 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-balance">Bookmarks</h2>
        <span className="text-xs text-x-text-secondary tabular-nums">
          {activeIndex + 1}/{total}
        </span>
      </div>

      <div className="relative h-[19rem] select-none touch-pan-y">
        {visibleCards.map(({ bookmark, delta, index }) => {
          const isTop = delta === 0;
          const isExiting =
            exiting !== null && exiting.index === index;

          let translateX = 0;
          let translateY = delta * 8;
          let rotate = 0;
          let scale = 1 - delta * 0.04;
          let opacity = Math.max(0.2, 1 - delta * 0.2);

          if (isTop && drag.active) {
            translateX = drag.x;
            rotate = drag.x * ROTATION_FACTOR;
            translateY = Math.abs(drag.y) * -0.05;
          }

          if (isExiting) {
            translateX = exiting.direction === "right" ? 500 : -500;
            rotate =
              exiting.direction === "right" ? 30 : -30;
            opacity = 0;
          }

          const media = bookmark.media.find(
            (item) => item.type === "photo",
          );

          return (
            <div
              key={bookmark.tweetId}
              onPointerDown={isTop ? handlePointerDown : undefined}
              onPointerMove={isTop ? handlePointerMove : undefined}
              onPointerUp={isTop ? handlePointerUp : undefined}
              onClick={() => {
                if (!drag.active && isTop && !exiting) {
                  onOpenBookmark(bookmark);
                }
              }}
              className={`absolute inset-0 w-full rounded-2xl border border-x-border bg-x-bg p-4 text-left ${
                isExiting
                  ? "transition-[transform,opacity] duration-300 ease-in"
                  : drag.active && isTop
                    ? ""
                    : "transition-[transform,opacity] duration-300 ease-out"
              } ${isTop ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
                opacity,
                zIndex: 100 - delta,
              }}
            >
              {/* Swipe hint overlays */}
              {isTop && drag.active && (
                <>
                  <div
                    className="absolute inset-0 rounded-2xl border-2 border-green-400 pointer-events-none transition-opacity"
                    style={{
                      opacity: Math.max(
                        0,
                        Math.min(1, drag.x / SWIPE_THRESHOLD),
                      ),
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-2xl border-2 border-red-400 pointer-events-none transition-opacity"
                    style={{
                      opacity: Math.max(
                        0,
                        Math.min(1, -drag.x / SWIPE_THRESHOLD),
                      ),
                    }}
                  />
                </>
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

              <p className="text-sm leading-6 text-pretty line-clamp-5">
                {previewText(bookmark.text)}
              </p>

              {media && (
                <img
                  src={media.url}
                  alt=""
                  className="mt-3 h-24 w-full rounded-xl object-cover"
                  loading="lazy"
                  draggable={false}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
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
