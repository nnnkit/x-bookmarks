import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "../types";
import { compactPreview } from "../lib/text";
import { formatClock } from "../lib/time";

interface NewTabHomeProps {
  bookmarks: Bookmark[];
  syncing: boolean;
  onSync: () => void;
  onOpenLibrary: () => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onOpenSettings: () => void;
}

type BreathMode = "zen" | "pick" | "list";

interface DecoratedBookmark {
  bookmark: Bookmark;
  title: string;
  excerpt: string;
  category: string;
  savedLabel: string;
  minutes: number;
  isRead: boolean;
}

const READ_IDS_KEY = "tw_breath_read_ids";
const MAX_ROTATION_ITEMS = 5;
const ROTATION_INTERVAL_MS = 5000;
const TRANSITION_MS = 220;
const PROGRESS_TICK_MS = 50;

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pickTitle(bookmark: Bookmark): string {
  const articleTitle = bookmark.article?.title?.trim();
  if (articleTitle) return articleTitle;
  return compactPreview(toSingleLine(bookmark.text), 92);
}

function pickExcerpt(bookmark: Bookmark): string {
  const articleText = bookmark.article?.plainText?.trim();
  if (articleText) return compactPreview(articleText, 210);
  return compactPreview(toSingleLine(bookmark.text), 210);
}

function estimateReadingMinutes(bookmark: Bookmark): number {
  const fullText = toSingleLine(
    `${bookmark.text} ${bookmark.article?.plainText ?? ""} ${
      bookmark.quotedTweet?.text ?? ""
    }`,
  );
  const words = fullText.length === 0 ? 0 : fullText.split(" ").length;
  return Math.max(1, Math.round(words / 200));
}

function inferCategory(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";

  const text = `${bookmark.text} ${bookmark.article?.title ?? ""}`.toLowerCase();
  if (/\b(ai|llm|gpt|alignment|model)\b/.test(text)) return "AI";
  if (/\b(startup|indie|saas|founder|revenue|launch)\b/.test(text))
    return "Indie";
  if (/\b(code|infra|engineering|database|performance)\b/.test(text))
    return "Engineering";
  if (/\b(design|ux|ui|product)\b/.test(text)) return "Product";
  return "Reading";
}

function formatSavedLabel(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "saved recently";

  const minutes = Math.floor(diffMs / 60_000);
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

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
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

export function NewTabHome({
  bookmarks,
  syncing,
  onSync,
  onOpenLibrary,
  onOpenBookmark,
  onOpenSettings,
}: NewTabHomeProps) {
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<BreathMode>("zen");
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [focusedBookmarkId, setFocusedBookmarkId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const [cardEngaged, setCardEngaged] = useState(false);
  const [cardTransitioning, setCardTransitioning] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  const items = useMemo<DecoratedBookmark[]>(
    () =>
      bookmarks.map((bookmark) => ({
        bookmark,
        title: pickTitle(bookmark),
        excerpt: pickExcerpt(bookmark),
        category: inferCategory(bookmark),
        savedLabel: formatSavedLabel(bookmark.createdAt),
        minutes: estimateReadingMinutes(bookmark),
        isRead: readIds.has(bookmark.tweetId),
      })),
    [bookmarks, readIds],
  );

  const unreadItems = useMemo(
    () => items.filter((item) => !item.isRead),
    [items],
  );

  const rotationPool = useMemo(
    () =>
      (unreadItems.length > 0 ? unreadItems : items).slice(0, MAX_ROTATION_ITEMS),
    [items, unreadItems],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!focusedBookmarkId) return;
    const stillExists = items.some(
      (item) => item.bookmark.tweetId === focusedBookmarkId,
    );
    if (!stillExists) {
      setFocusedBookmarkId(null);
    }
  }, [focusedBookmarkId, items]);

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

  useEffect(() => {
    setProgressMs(0);
  }, [currentIndex, mode, rotationPool.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mode !== "zen") {
        event.preventDefault();
        setMode("zen");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  const totalMinutes = useMemo(
    () => unreadItems.reduce((sum, item) => sum + item.minutes, 0),
    [unreadItems],
  );

  const currentItem = rotationPool[currentIndex] ?? null;
  const pickItem = useMemo(() => {
    if (focusedBookmarkId) {
      return (
        items.find((item) => item.bookmark.tweetId === focusedBookmarkId) ??
        currentItem
      );
    }

    return currentItem;
  }, [currentItem, focusedBookmarkId, items]);

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
    mode !== "zen" ||
    cardEngaged ||
    cardTransitioning ||
    rotationPool.length <= 1;

  useEffect(() => {
    if (rotationPaused) return;

    const timer = window.setInterval(() => {
      setProgressMs((previous) => {
        const next = previous + PROGRESS_TICK_MS;
        if (next >= ROTATION_INTERVAL_MS) {
          switchCard(currentIndexRef.current + 1);
          return 0;
        }
        return next;
      });
    }, PROGRESS_TICK_MS);

    return () => window.clearInterval(timer);
  }, [rotationPaused, switchCard]);

  const openPickFromCurrent = () => {
    if (!currentItem) return;
    setFocusedBookmarkId(currentItem.bookmark.tweetId);
    setMode("pick");
  };

  const progressPercent = prefersReducedMotion
    ? 0
    : Math.min(100, Math.round((progressMs / ROTATION_INTERVAL_MS) * 100));

  return (
    <div className="breath-home relative min-h-dvh overflow-hidden">
      <div className="breath-ambient pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
        <button
          type="button"
          onClick={onOpenSettings}
          className="breath-icon-btn ml-auto"
          aria-label="Open settings"
          title="Settings"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
          </svg>
        </button>

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
          {mode === "zen" && (
            <section className="space-y-8">
              <div className="text-center">
                <h1
                  className="breath-clock text-balance tabular-nums"
                  aria-label={`Current time: ${formatClock(now)}`}
                >
                  {formatClock(now)}
                </h1>
              </div>

              {currentItem ? (
                <>
                  <article
                    className={`breath-card ${cardEngaged ? "is-engaged" : ""}`}
                    onMouseEnter={() => setCardEngaged(true)}
                    onMouseLeave={() => setCardEngaged(false)}
                    onFocusCapture={() => setCardEngaged(true)}
                    onBlurCapture={(event) => {
                      const nextTarget =
                        event.relatedTarget instanceof Node
                          ? event.relatedTarget
                          : null;
                      if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                        setCardEngaged(false);
                      }
                    }}
                    onClick={openPickFromCurrent}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openPickFromCurrent();
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Read ${currentItem.title} by @${currentItem.bookmark.author.screenName}, ${currentItem.minutes} min read`}
                  >
                    <div
                      className="breath-progress-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progressPercent}
                    >
                      <span
                        className="breath-progress-fill"
                        style={{ transform: `scaleX(${progressPercent / 100})` }}
                      />
                    </div>

                    <div
                      className={`breath-card-content ${
                        cardTransitioning ? "breath-card-content--leaving" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="breath-eyebrow">Pick up where you left off</p>
                        <p className="breath-meta text-right">
                          {currentItem.category} · {currentItem.minutes} min
                        </p>
                      </div>

                      <h2 className="breath-title mt-4 text-balance">
                        {currentItem.title}
                      </h2>
                      <p className="breath-meta mt-4">
                        @{currentItem.bookmark.author.screenName} ·{" "}
                        {currentItem.savedLabel}
                      </p>

                      <div
                        className="mt-5 flex items-center justify-center gap-2"
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
                              aria-label={`Article ${index + 1} of ${
                                rotationPool.length
                              }`}
                              className={`breath-dot ${active ? "is-active" : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                switchCard(index);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === " " || event.key === "Enter") {
                                  event.preventDefault();
                                  switchCard(index);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </article>

                  <div className="breath-actions">
                    <button
                      type="button"
                      className="breath-link"
                      onClick={() => setMode("list")}
                    >
                      {bookmarks.length} saved →
                    </button>
                    <span aria-hidden className="breath-divider">
                      |
                    </span>
                    <button
                      type="button"
                      className="breath-link"
                      onClick={onOpenLibrary}
                    >
                      Open all bookmarks
                    </button>
                  </div>
                </>
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
            </section>
          )}

          {mode === "pick" && (
            <section className="breath-panel">
              {pickItem ? (
                <>
                  <p className="breath-eyebrow">
                    {pickItem.category} · {pickItem.minutes} min read
                  </p>
                  <h2 className="breath-pick-title mt-5 text-balance">
                    {pickItem.title}
                  </h2>
                  <p className="breath-pick-excerpt mt-4 text-pretty">
                    {pickItem.excerpt}
                  </p>
                  <p className="breath-meta mt-5">
                    @{pickItem.bookmark.author.screenName} · {pickItem.savedLabel}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      className="breath-btn breath-btn--primary"
                      onClick={() => openForReading(pickItem)}
                    >
                      Read now
                    </button>
                    <button
                      type="button"
                      className="breath-btn breath-btn--secondary"
                      onClick={() => setMode("list")}
                    >
                      See all ({bookmarks.length})
                    </button>
                    <button
                      type="button"
                      className="breath-btn breath-btn--ghost"
                      onClick={onOpenLibrary}
                    >
                      Full page
                    </button>
                  </div>
                </>
              ) : (
                <p className="breath-empty text-pretty">
                  No bookmark is available right now. Try syncing first.
                </p>
              )}

              <button
                type="button"
                className="breath-link mt-8"
                onClick={() => setMode("zen")}
              >
                ← Back to clock
              </button>
            </section>
          )}

          {mode === "list" && (
            <section className="breath-panel">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="breath-list-title text-balance">Your Reading List</h2>
                  <p className="breath-meta mt-1">
                    {unreadItems.length} unread · ~{totalMinutes} min total
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="breath-btn breath-btn--ghost breath-btn--compact"
                    onClick={onOpenLibrary}
                  >
                    Expand
                  </button>
                  <button
                    type="button"
                    className="breath-btn breath-btn--ghost breath-btn--compact"
                    onClick={() => setMode("zen")}
                  >
                    Hide
                  </button>
                </div>
              </div>

              <div className="mt-5 divide-y divide-[rgba(255,255,255,0.05)]">
                {items.length > 0 ? (
                  items.map((item) => (
                    <button
                      type="button"
                      key={item.bookmark.tweetId}
                      className={`breath-list-item ${
                        item.isRead ? "breath-list-item--read" : ""
                      }`}
                      onClick={() => openForReading(item)}
                      aria-label={`${item.title}${
                        item.isRead ? ", already read" : ""
                      }`}
                    >
                      <span className="breath-time-badge">
                        {item.isRead ? "✓" : `${item.minutes}m`}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="breath-item-title">{item.title}</span>
                        <span className="breath-meta mt-1 block">
                          @{item.bookmark.author.screenName} · {item.category}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="breath-empty py-8 text-pretty">
                    No bookmarks yet. Sync once and your list will show up here.
                  </p>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
