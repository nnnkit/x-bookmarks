import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBookmarks } from "./hooks/useBookmarks";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { useKeyboardNavigation } from "./hooks/useKeyboard";
import { pickRelatedBookmarks } from "./lib/related";
import { exportGraphqlDocs } from "./api/twitter";
import { Onboarding } from "./components/Onboarding";
import { NewTabHome } from "./components/NewTabHome";
import { SearchBar } from "./components/SearchBar";
import { BookmarkCard } from "./components/BookmarkCard";
import { ReaderView } from "./components/ReaderView";
import { SettingsModal } from "./components/SettingsModal";
import type { Bookmark } from "./types";

type AppView = "home" | "library";

export default function App() {
  const { phase } = useAuth();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const isReady = phase === "ready";
  const { bookmarks, syncState, refresh, unbookmark } = useBookmarks(isReady);
  const [view, setView] = useState<AppView>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [exportingDocs, setExportingDocs] = useState(false);
  const [unbookmarkingId, setUnbookmarkingId] = useState<string | null>(null);
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);

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

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, bookmarks, shuffleSeed],
  );

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

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks,
    focusedIndex,
    setFocusedIndex,
    openBookmark,
    closeReader,
    setSelectedBookmark,
  });

  // Loading
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-x-bg">
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

  // Reader view
  if (selectedBookmark) {
    return (
      <>
        <ReaderView
          bookmark={selectedBookmark}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={openBookmark}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          onBack={closeReader}
          onUnbookmark={handleUnbookmark}
          unbookmarking={unbookmarkingId === selectedBookmark.tweetId}
          onShuffle={() => setShuffleSeed((s) => s + 1)}
        />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          bookmarks={bookmarks}
        />
      </>
    );
  }

  // Home screen
  if (view === "home") {
    return (
      <>
        <NewTabHome
          bookmarks={bookmarks}
          syncing={syncState.phase === "syncing"}
          onSync={refresh}
          onOpenLibrary={() => setView("library")}
          onOpenBookmark={openBookmark}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          bookmarks={bookmarks}
        />
      </>
    );
  }

  // Bookmarks library
  return (
    <div className="min-h-dvh bg-x-bg text-x-text">
      <SearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onRefresh={refresh}
        onExportApiDocs={exportApiDocs}
        onOpenSettings={() => setSettingsOpen(true)}
        syncing={syncState.phase === "syncing"}
        exportingDocs={exportingDocs}
        bookmarkCount={filteredBookmarks.length}
        onBack={() => setView("home")}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        bookmarks={bookmarks}
      />

      {headerMessage && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="bg-x-card border border-x-border text-x-text rounded-xl px-4 py-2.5 text-sm">
            {headerMessage}
          </div>
        </div>
      )}

      {/* Error banner */}
      {syncState.phase === "error" && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
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

      <main className="max-w-3xl mx-auto">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 pb-6 pt-4">
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
