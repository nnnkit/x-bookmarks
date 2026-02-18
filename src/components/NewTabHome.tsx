import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "../types";
import { formatClock } from "../lib/time";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../lib/bookmark-utils";
import { useWallpaper } from "../hooks/useWallpaper";
import { useTopSites } from "../hooks/useTopSites";

interface Props {
  bookmarks: Bookmark[];
  detailedTweetIds: Set<string>;
  syncing: boolean;
  showTopSites: boolean;
  showSearchBar: boolean;
  topSitesLimit: number;
  onSync: () => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onOpenSettings: () => void;
  onOpenReading: () => void;
}

interface DecoratedBookmark {
  bookmark: Bookmark;
  title: string;
  excerpt: string;
  savedLabel: string;
  minutes: number | null;
  isRead: boolean;
}

const READ_IDS_KEY = "tw_breath_read_ids";
const MAX_ROTATION_ITEMS = 5;
const ROTATION_INTERVAL_MS = 30000;
const TRANSITION_MS = 220;

function formatSavedLabel(timestamp: number, nowMs: number): string {
  const diffMs = nowMs - timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "saved recently";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes <= 0) return "saved just now";
  if (minutes < 60) return `saved ${minutes || 1} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `saved ${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `saved ${days} day${days === 1 ? "" : "s"} ago`;

  const savedOn = new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `saved ${savedOn}`;
}

function loadReadIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set<string>();
  const raw = localStorage.getItem(READ_IDS_KEY);
  if (!raw) return new Set<string>();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function persistReadIds(value: Set<string>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(value)));
}

const BOOKMARK_ICON = (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
    <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" />
  </svg>
);

const SETTINGS_ICON = (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
    <path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
  </svg>
);

const CHEVRON_LEFT_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
    <path
      fillRule="evenodd"
      d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
      clipRule="evenodd"
    />
  </svg>
);

const CHEVRON_RIGHT_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
    <path
      fillRule="evenodd"
      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

const SEARCH_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
      clipRule="evenodd"
    />
  </svg>
);

export function NewTabHome({
  bookmarks,
  detailedTweetIds,
  syncing,
  showTopSites,
  showSearchBar,
  topSitesLimit,
  onSync,
  onOpenBookmark,
  onOpenSettings,
  onOpenReading,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardEngaged, setCardEngaged] = useState(false);
  const [cardTransitioning, setCardTransitioning] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const {
    wallpaperUrl,
    wallpaperTitle,
    hasNext,
    hasPrev,
    next: nextWallpaper,
    prev: prevWallpaper,
  } = useWallpaper();
  const { sites: topSites } = useTopSites(topSitesLimit);

  const nowMinute = useMemo(() => Math.floor(now.getTime() / 60000), [now]);

  const { items, unreadItems } = useMemo(() => {
    const allItems: DecoratedBookmark[] = bookmarks.map((bookmark) => ({
      bookmark,
      title: pickTitle(bookmark),
      excerpt: pickExcerpt(bookmark),
      savedLabel: formatSavedLabel(bookmark.createdAt, nowMinute * 60000),
      minutes: detailedTweetIds.has(bookmark.tweetId)
        ? estimateReadingMinutes(bookmark)
        : null,
      isRead: readIds.has(bookmark.tweetId),
    }));
    const unread = allItems.filter((item) => !item.isRead);
    return { items: allItems, unreadItems: unread };
  }, [bookmarks, detailedTweetIds, nowMinute, readIds]);

  const rotationPool = useMemo(
    () =>
      (unreadItems.length > 0 ? unreadItems : items).slice(
        0,
        MAX_ROTATION_ITEMS,
      ),
    [items, unreadItems],
  );
  const showWallpaper = Boolean(wallpaperUrl && !imgError);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [wallpaperUrl]);

  useEffect(() => {
    if (bookmarks.length === 0) return;

    setReadIds((previous) => {
      if (previous.size === 0) return previous;

      const liveIds = new Set(bookmarks.map((bookmark) => bookmark.tweetId));
      let changed = false;
      const next = new Set<string>();

      for (const id of previous) {
        if (liveIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      if (!changed) return previous;

      persistReadIds(next);
      return next;
    });
  }, [bookmarks]);

  useEffect(() => {
    if (rotationPool.length === 0) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((previous) =>
      Math.min(previous, Math.max(0, rotationPool.length - 1)),
    );
  }, [rotationPool.length]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    [],
  );

  const currentItem = rotationPool[currentIndex] ?? null;

  const markAsRead = useCallback((tweetId: string) => {
    setReadIds((previous) => {
      if (previous.has(tweetId)) return previous;
      const next = new Set(previous);
      next.add(tweetId);
      persistReadIds(next);
      return next;
    });
  }, []);

  const openForReading = useCallback(
    (item: DecoratedBookmark | null) => {
      if (!item) return;
      markAsRead(item.bookmark.tweetId);
      onOpenBookmark(item.bookmark);
    },
    [markAsRead, onOpenBookmark],
  );

  const switchCard = useCallback(
    (targetIndex: number) => {
      if (rotationPool.length <= 1) return;

      const normalized =
        ((targetIndex % rotationPool.length) + rotationPool.length) %
        rotationPool.length;

      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }

      setCardTransitioning(true);
      transitionTimerRef.current = window.setTimeout(() => {
        setCurrentIndex(normalized);
        setCardTransitioning(false);
        transitionTimerRef.current = null;
      }, TRANSITION_MS);
    },
    [rotationPool.length],
  );

  const rotationPaused =
    prefersReducedMotion ||
    !isDocumentVisible ||
    cardEngaged ||
    cardTransitioning ||
    rotationPool.length <= 1;

  useEffect(() => {
    if (rotationPaused) return;

    const timer = window.setTimeout(() => {
      switchCard(currentIndexRef.current + 1);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [rotationPaused, switchCard, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "ArrowLeft") {
        switchCard(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        switchCard(currentIndex + 1);
      } else if (e.key === "Enter" || e.key === "o") {
        openForReading(currentItem);
      } else if (e.key === "l") {
        onOpenReading();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, currentItem, switchCard, openForReading, onOpenReading]);

  return (
    <div className="breath-home relative min-h-dvh overflow-hidden">
      {showWallpaper && (
        <img
          src={wallpaperUrl ?? ""}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className="breath-wallpaper pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: imgLoaded ? 0.6 : 0 }}
        />
      )}
      <div className="breath-ambient pointer-events-none absolute inset-0" />
      <div className="breath-grain pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
          <section className="mx-auto w-full max-w-lg space-y-6">
            <div className="text-center">
              <h1
                className="breath-clock text-balance tabular-nums"
                aria-label={`Current time: ${formatClock(now)}`}
              >
                {formatClock(now)}
              </h1>
            </div>

            {showSearchBar && (
              <form
                className="breath-search"
                action="https://www.google.com/search"
                method="GET"
                role="search"
              >
                <span className="breath-search-icon">{SEARCH_ICON}</span>
                <input
                  ref={searchRef}
                  type="text"
                  name="q"
                  className="breath-search-input"
                  placeholder="Search Google"
                  autoComplete="off"
                />
                <kbd className="breath-search-kbd">/</kbd>
              </form>
            )}

            {showTopSites && topSites.length > 0 && (
              <nav
                className="flex items-center justify-center gap-4 flex-wrap"
                aria-label="Quick links"
              >
                {topSites.map((site) => (
                  <a
                    key={site.url}
                    href={site.url}
                    className="breath-quick-link"
                    title={site.title}
                  >
                    <span className="breath-quick-link-icon">
                      <img
                        src={site.faviconUrl}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                      />
                    </span>
                    <span className="breath-quick-link-label">
                      {site.hostname.replace(/^www\./, "")}
                    </span>
                  </a>
                ))}
              </nav>
            )}
          </section>
        </main>

        <footer className="mx-auto w-full max-w-lg pb-12">
          {currentItem ? (
            <div className="space-y-4">
              <article
                className={`breath-card breath-card--zen ${
                  cardEngaged ? "is-engaged" : ""
                }`}
                onMouseEnter={() => setCardEngaged(true)}
                onMouseLeave={() => setCardEngaged(false)}
                onFocusCapture={() => setCardEngaged(true)}
                onBlurCapture={(event) => {
                  const nextTarget =
                    event.relatedTarget instanceof Node
                      ? event.relatedTarget
                      : null;
                  if (
                    !nextTarget ||
                    !event.currentTarget.contains(nextTarget)
                  ) {
                    setCardEngaged(false);
                  }
                }}
                onClick={() => openForReading(currentItem)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openForReading(currentItem);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Read ${currentItem.title} by @${
                  currentItem.bookmark.author.screenName
                }${
                  currentItem.minutes !== null
                    ? `, ${currentItem.minutes} min read`
                    : ""
                }`}
              >
                <div
                  className="breath-progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={rotationPaused ? 0 : undefined}
                >
                  <span
                    key={currentIndex}
                    className={`breath-progress-fill${rotationPaused ? "" : " is-animating"}`}
                  />
                </div>

                <div
                  className={`breath-card-content ${
                    cardTransitioning ? "breath-card-content--leaving" : ""
                  }`}
                >
                  <div className="flex justify-between">
                    <p className="breath-eyebrow">Pick up where you left off</p>
                    <kbd className="breath-kbd">O</kbd>
                  </div>

                  <h2 className="breath-title mt-4 text-balance">
                    {currentItem.title}
                  </h2>
                  <p className="breath-description mt-2.5 text-pretty">
                    {currentItem.excerpt}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="breath-meta">
                      @{currentItem.bookmark.author.screenName}
                    </p>
                  </div>
                </div>
              </article>

              <div
                className="breath-dots-row"
                role="tablist"
                aria-label="Recommendation dots"
              >
                {rotationPool.map((item, index) => {
                  const active = index === currentIndex;
                  return (
                    <button
                      key={item.bookmark.tweetId}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={`Article ${index + 1} of ${rotationPool.length}`}
                      className={`breath-dot ${active ? "is-active" : ""}`}
                      onClick={() => switchCard(index)}
                    >
                      <span className="breath-dot-visual" />
                    </button>
                  );
                })}
              </div>

              <div className="breath-actions">
                <button
                  type="button"
                  className="breath-btn breath-btn--secondary"
                  onClick={onOpenReading}
                >
                  Open all bookmarks
                  <kbd className="breath-kbd">L</kbd>
                </button>
              </div>
            </div>
          ) : (
            <article className="breath-card text-center">
              <p className="breath-eyebrow">Your reading list is quiet</p>
              <p className="breath-empty mt-4 text-pretty">
                Sync your bookmarks once, and this tab will gently surface what
                to read next.
              </p>
              <button
                type="button"
                onClick={onSync}
                disabled={syncing}
                className="breath-btn breath-btn--primary mt-6"
              >
                {syncing ? "Syncing..." : "Sync bookmarks"}
              </button>
            </article>
          )}
        </footer>

        <button
          type="button"
          onClick={onOpenReading}
          className="breath-icon-btn breath-reading-btn"
          aria-label="Reading progress"
          title="Reading"
        >
          {BOOKMARK_ICON}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="breath-icon-btn breath-settings-btn"
          aria-label="Open settings"
          title="Settings"
        >
          {SETTINGS_ICON}
        </button>

        {showWallpaper && (
          <div className="breath-wallpaper-nav">
            {(hasPrev || hasNext) && (
              <div className="breath-wallpaper-arrows">
                <button
                  type="button"
                  className="breath-wallpaper-arrow"
                  onClick={prevWallpaper}
                  disabled={!hasPrev}
                  aria-label="Previous wallpaper"
                >
                  {CHEVRON_LEFT_ICON}
                </button>
                <button
                  type="button"
                  className="breath-wallpaper-arrow"
                  onClick={nextWallpaper}
                  disabled={!hasNext}
                  aria-label="Next wallpaper"
                >
                  {CHEVRON_RIGHT_ICON}
                </button>
              </div>
            )}
            {wallpaperTitle && (
              <p className="breath-wallpaper-label">{wallpaperTitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
