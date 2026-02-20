import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { ArrowLeft, ArrowsClockwise } from "@phosphor-icons/react";
import type { Bookmark } from "../types";
import type { ContinueReadingItem } from "../hooks/useContinueReading";
import { pickTitle, estimateReadingMinutes } from "../lib/bookmark-utils";
import { timeAgo } from "../lib/time";
import { cn } from "../lib/cn";

export type ReadingTab = "continue" | "unread";

interface Props {
  continueReadingItems: ContinueReadingItem[];
  unreadBookmarks: Bookmark[];
  syncing: boolean;
  activeTab: ReadingTab;
  onTabChange: (tab: ReadingTab) => void;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onSync: () => void;
  onBack: () => void;
}

function inferKindBadge(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";
  if (bookmark.hasLink) return "Link";
  return "Post";
}

export function BookmarksList({
  continueReadingItems,
  unreadBookmarks,
  syncing,
  activeTab,
  onTabChange,
  onOpenBookmark,
  onSync,
  onBack,
}: Props) {
  const containerWidthClass = "max-w-3xl";
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (prevActiveTab !== activeTab) {
    setPrevActiveTab(activeTab);
    setFocusedIndex(-1);
  }
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { inProgress, completed } = useMemo(() => {
    const ip: ContinueReadingItem[] = [];
    const cp: ContinueReadingItem[] = [];
    for (const item of continueReadingItems) {
      if (item.progress.completed) {
        cp.push(item);
      } else {
        ip.push(item);
      }
    }
    return { inProgress: ip, completed: cp };
  }, [continueReadingItems]);

  const newestUnreadId = useMemo(() => {
    if (unreadBookmarks.length === 0) return null;
    let newest = unreadBookmarks[0];
    for (const b of unreadBookmarks) {
      if (b.createdAt > newest.createdAt) newest = b;
    }
    return newest.tweetId;
  }, [unreadBookmarks]);

  const visibleBookmarks = useMemo(() => {
    if (activeTab === "continue") {
      return [
        ...inProgress.map((item) => item.bookmark),
        ...completed.map((item) => item.bookmark),
      ];
    }
    return unreadBookmarks;
  }, [activeTab, inProgress, completed, unreadBookmarks]);

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < itemRefs.current.length) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  useHotkeys("j, ArrowDown", () => {
    setFocusedIndex((prev) =>
      prev < visibleBookmarks.length - 1 ? prev + 1 : prev,
    );
  }, { preventDefault: true }, [visibleBookmarks.length]);

  useHotkeys("k, ArrowUp", () => {
    setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, { preventDefault: true });

  useHotkeys("enter, o", () => {
    if (focusedIndex >= 0 && focusedIndex < visibleBookmarks.length) {
      onOpenBookmark(visibleBookmarks[focusedIndex]);
    }
  }, { preventDefault: true }, [focusedIndex, visibleBookmarks, onOpenBookmark]);

  useHotkeys("escape", () => onBack(), {
    preventDefault: true,
  }, [onBack]);

  useHotkeys("tab", () => {
    onTabChange(activeTab === "continue" ? "unread" : "continue");
  }, { preventDefault: true }, [activeTab, onTabChange]);

  let itemIndex = 0;

  return (
    <div className="min-h-dvh bg-x-bg">
      <div className="sticky top-0 z-10 border-b border-x-border bg-x-bg/80 backdrop-blur-md">
        <div
          className={cn("mx-auto flex items-center gap-3 px-4 py-3", containerWidthClass)}
        >
          <button
            onClick={onBack}
            aria-label="Back to home"
            title="Back"
            className="rounded-full p-2 text-x-text transition-colors hover:bg-x-hover"
          >
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-lg font-semibold text-x-text">Reading</span>
          <div className="ml-auto">
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="rounded-full p-2 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
              aria-label="Sync bookmarks"
              title="Sync bookmarks"
            >
              <ArrowsClockwise className={cn("size-5", syncing && "animate-spin")} />
            </button>
          </div>
        </div>
        <div className={cn("mx-auto flex px-4", containerWidthClass)} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "continue"}
            onClick={() => onTabChange("continue")}
            className={cn("relative px-4 py-2.5 text-sm font-medium transition-colors", activeTab === "continue" ? "text-x-text" : "text-x-text-secondary hover:text-x-text")}
          >
            Continue Reading
            {inProgress.length > 0 && (
              <span className="ml-1.5 text-xs text-x-text-secondary">
                {inProgress.length}
              </span>
            )}
            {activeTab === "continue" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-x-blue" />
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "unread"}
            onClick={() => onTabChange("unread")}
            className={cn("relative px-4 py-2.5 text-sm font-medium transition-colors", activeTab === "unread" ? "text-x-text" : "text-x-text-secondary hover:text-x-text")}
          >
            Unread
            {unreadBookmarks.length > 0 && (
              <span className="ml-1.5 text-xs text-x-text-secondary">
                {unreadBookmarks.length}
              </span>
            )}
            {activeTab === "unread" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-x-blue" />
            )}
          </button>
        </div>
      </div>

      <main className={cn(containerWidthClass, "mx-auto px-4 pb-16 pt-6")}>
        {activeTab === "continue" && (
          <>
            {inProgress.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-x-text-secondary">
                  In Progress
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
                      className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-x-hover", focusedIndex === idx ? "border-x-blue ring-2 ring-x-blue/40 bg-x-hover" : "border-x-border bg-x-card")}
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
                          @{bookmark.author.screenName} &middot; Last read{" "}
                          {timeAgo(progress.lastReadAt)}
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
                      className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors", focusedIndex === idx ? "border-x-blue ring-2 ring-x-blue/40 bg-x-hover opacity-100" : "border-x-border bg-x-card opacity-70 hover:bg-x-hover hover:opacity-100")}
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
                          {timeAgo(progress.lastReadAt)}
                        </p>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </section>
            )}

            {inProgress.length === 0 && completed.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-x-text-secondary text-lg">
                  No reading progress yet. Open a bookmark to start tracking.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "unread" && (
          <>
            {unreadBookmarks.length > 0 ? (
              <div className="space-y-2">
                {unreadBookmarks.map((bookmark) => {
                  const idx = itemIndex++;
                  const isNewest = bookmark.tweetId === newestUnreadId;
                  return (
                  <button
                    key={bookmark.tweetId}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    type="button"
                    onClick={() => onOpenBookmark(bookmark)}
                    className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-x-hover", focusedIndex === idx ? "border-x-blue ring-2 ring-x-blue/40 bg-x-hover" : "border-x-border bg-x-card")}
                  >
                    <img
                      src={bookmark.author.profileImageUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-x-text">
                          {pickTitle(bookmark)}
                        </p>
                        {isNewest && (
                          <span className="shrink-0 rounded-full bg-x-blue px-2 py-0.5 text-xs font-medium text-white">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-x-text-secondary">
                        @{bookmark.author.screenName} &middot;{" "}
                        {estimateReadingMinutes(bookmark)} min read &middot;{" "}
                        <span className="rounded bg-x-border/50 px-1.5 py-0.5 text-xs uppercase">
                          {inferKindBadge(bookmark)}
                        </span>
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-x-text-secondary text-lg">
                  All caught up! No unread bookmarks.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
