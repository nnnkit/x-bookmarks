import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBookmarks } from "./hooks/useBookmarks";
import { exportGraphqlDocs } from "./api/twitter";
import { Onboarding } from "./components/Onboarding";
import { SearchBar } from "./components/SearchBar";
import { BookmarkCard } from "./components/BookmarkCard";
import { ReaderView } from "./components/ReaderView";
import type { Bookmark } from "./types";

export default function App() {
  const { phase } = useAuth();
  const isReady = phase === "ready";
  const { bookmarks, syncState, refresh, unbookmark } = useBookmarks(isReady);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [exportingDocs, setExportingDocs] = useState(false);
  const [unbookmarkingId, setUnbookmarkingId] = useState<string | null>(null);
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks;
    const q = searchQuery.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.text.toLowerCase().includes(q) ||
        b.author.name.toLowerCase().includes(q) ||
        b.author.screenName.toLowerCase().includes(q),
    );
  }, [bookmarks, searchQuery]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedBookmark) return;
    const stillExists = bookmarks.some(
      (bookmark) => bookmark.tweetId === selectedBookmark.tweetId,
    );
    if (!stillExists) {
      setSelectedBookmark(null);
    }
  }, [bookmarks, selectedBookmark]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || focusedIndex >= filteredBookmarks.length) return;
    const id = filteredBookmarks[focusedIndex].id;
    const el = document.querySelector(`[data-bookmark-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedIndex, filteredBookmarks]);

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      setSelectedBookmark(bookmark);
    },
    [],
  );

  const closeReader = useCallback(() => {
    setSelectedBookmark(null);
  }, []);

  const handleUnbookmark = useCallback(
    async (tweetId: string) => {
      if (!tweetId || unbookmarkingId === tweetId) return;
      setUnbookmarkingId(tweetId);
      setHeaderMessage(null);

      try {
        await unbookmark(tweetId);
        if (selectedBookmark?.tweetId === tweetId) {
          setSelectedBookmark(null);
        }
        setHeaderMessage("Bookmark removed");
      } catch (error) {
        setHeaderMessage(
          error instanceof Error ? error.message : "Failed to remove bookmark",
        );
      } finally {
        setUnbookmarkingId(null);
      }
    },
    [unbookmark, selectedBookmark, unbookmarkingId],
  );

  const exportApiDocs = useCallback(async () => {
    if (exportingDocs) return;
    setExportingDocs(true);
    setHeaderMessage(null);

    try {
      const docs = await exportGraphqlDocs();
      const blob = new Blob([docs.markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = docs.fileName || "x-graphql-api-docs.md";
      anchor.click();
      URL.revokeObjectURL(url);
      setHeaderMessage(`Exported ${anchor.download}`);
    } catch (error) {
      setHeaderMessage(
        error instanceof Error ? error.message : "Failed to export API docs",
      );
    } finally {
      setExportingDocs(false);
    }
  }, [exportingDocs]);

  useEffect(() => {
    if (!headerMessage) return;
    const timer = window.setTimeout(() => {
      setHeaderMessage(null);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [headerMessage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA";

      // Reader view shortcuts
      if (selectedBookmark) {
        if (e.key === "Escape") {
          closeReader();
          return;
        }
        // Navigate between bookmarks in reader
        if (e.key === "j" || e.key === "ArrowRight") {
          const idx = filteredBookmarks.findIndex(
            (b) => b.id === selectedBookmark.id,
          );
          if (idx < filteredBookmarks.length - 1) {
            setSelectedBookmark(filteredBookmarks[idx + 1]);
          }
          return;
        }
        if (e.key === "k" || e.key === "ArrowLeft") {
          const idx = filteredBookmarks.findIndex(
            (b) => b.id === selectedBookmark.id,
          );
          if (idx > 0) {
            setSelectedBookmark(filteredBookmarks[idx - 1]);
          }
          return;
        }
        return;
      }

      // List view shortcuts
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
        return;
      }

      if (e.key === "Escape") {
        (document.activeElement as HTMLElement)?.blur();
        setFocusedIndex(-1);
        return;
      }

      if (isInput) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredBookmarks.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (
        (e.key === "Enter" || e.key === "o") &&
        focusedIndex >= 0
      ) {
        openBookmark(filteredBookmarks[focusedIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedBookmark,
    filteredBookmarks,
    focusedIndex,
    openBookmark,
    closeReader,
  ]);

  // Loading
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-x-bg">
        <svg
          viewBox="0 0 24 24"
          className="w-12 h-12 text-x-blue animate-pulse"
          fill="currentColor"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>
    );
  }

  // Not logged in or connecting
  if (phase === "need_login" || phase === "connecting") {
    return <Onboarding phase={phase} />;
  }

  // Syncing with no bookmarks yet
  if (syncState.phase === "syncing" && bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-x-bg text-x-text gap-4">
        <svg
          viewBox="0 0 24 24"
          className="w-12 h-12 text-x-blue animate-pulse"
          fill="currentColor"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <p className="text-lg font-bold">Syncing your bookmarks...</p>
        <p className="text-x-text-secondary tabular-nums">
          {syncState.total} found
        </p>
      </div>
    );
  }

  // Reader view
  if (selectedBookmark) {
    return (
      <ReaderView
        bookmark={selectedBookmark}
        onBack={closeReader}
        onUnbookmark={handleUnbookmark}
        unbookmarking={unbookmarkingId === selectedBookmark.tweetId}
      />
    );
  }

  // Bookmark list
  return (
    <div className="min-h-screen bg-x-bg text-x-text">
      <SearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onRefresh={refresh}
        onExportApiDocs={exportApiDocs}
        syncing={syncState.phase === "syncing"}
        exportingDocs={exportingDocs}
        bookmarkCount={filteredBookmarks.length}
      />

      {headerMessage && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-x-card border border-x-border text-x-text rounded-xl px-4 py-2.5 text-sm">
            {headerMessage}
          </div>
        </div>
      )}

      {/* Error banner */}
      {syncState.phase === "error" && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="flex items-center justify-between bg-red-900/30 border border-red-800 text-red-200 rounded-xl px-4 py-2.5 text-sm">
            <span>
              {syncState.error === "reconnecting"
                ? "Reconnecting to X..."
                : syncState.error}
            </span>
            {syncState.error !== "reconnecting" && (
              <button
                onClick={refresh}
                className="text-x-blue hover:underline ml-2"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto">
        {bookmarks.length === 0 && syncState.phase === "done" && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <svg
              viewBox="0 0 24 24"
              className="w-12 h-12 text-x-text-secondary mb-4"
              fill="currentColor"
            >
              <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" />
            </svg>
            <p className="text-x-text-secondary text-lg">
              No bookmarks found.
            </p>
          </div>
        )}

        {filteredBookmarks.length === 0 &&
          bookmarks.length > 0 &&
          searchQuery && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-x-text-secondary text-lg">
                No bookmarks match "{searchQuery}"
              </p>
            </div>
          )}

        <div className="divide-y divide-x-border">
          {filteredBookmarks.map((bookmark, i) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              isFocused={i === focusedIndex}
              onClick={() => openBookmark(bookmark)}
              onUnbookmark={() => handleUnbookmark(bookmark.tweetId)}
              unbookmarking={unbookmarkingId === bookmark.tweetId}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
