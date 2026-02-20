import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useBookmarks, useDetailedTweetIds } from "./hooks/useBookmarks";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { useKeyboardNavigation } from "./hooks/useKeyboard";
import { useReadIds } from "./hooks/useReadIds";
import { ensureReadingProgressExists } from "./db";
import { pickRelatedBookmarks } from "./lib/related";
import { resetLocalData } from "./lib/reset";
import { Onboarding } from "./components/Onboarding";
import { NewTabHome } from "./components/NewTabHome";
import { ReaderView } from "./components/ReaderView";
import { ReadingView, type ReadingTab } from "./components/ReadingView";
import { SettingsModal } from "./components/SettingsModal";
import { useContinueReading } from "./hooks/useContinueReading";
import type { Bookmark } from "./types";

type AppView = "home" | "reading";

export default function App() {
  const { phase, startLogin } = useAuth();
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
  const isReady = phase === "ready";
  const { bookmarks, syncState, refresh, unbookmark } = useBookmarks(isReady);
  const detailedTweetIds = useDetailedTweetIds();
  const { markAsRead } = useReadIds(bookmarks);
  const {
    continueReading,
    allUnread,
    refresh: refreshContinueReading,
  } = useContinueReading(bookmarks);
  const [view, setView] = useState<AppView>("home");
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingTab, setReadingTab] = useState<ReadingTab>(() => {
    const stored = localStorage.getItem("readingTab");
    return stored === "unread" ? "unread" : "continue";
  });
  const handleReadingTabChange = useCallback((tab: ReadingTab) => {
    setReadingTab(tab);
    localStorage.setItem("readingTab", tab);
  }, []);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  if (
    selectedBookmark &&
    !bookmarks.some(
      (bookmark) => bookmark.tweetId === selectedBookmark.tweetId,
    )
  ) {
    setSelectedBookmark(null);
  }

  const relatedBookmarks = useMemo(
    () => pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, bookmarks, shuffleSeed],
  );

  const openedTweetIds = useMemo(
    () => new Set(continueReading.map((item) => item.progress.tweetId)),
    [continueReading],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      ensureReadingProgressExists(bookmark.tweetId).then(refreshContinueReading);
      setSelectedBookmark(bookmark);
    },
    [refreshContinueReading],
  );

  const selectedIndex = selectedBookmark
    ? bookmarks.findIndex((b) => b.id === selectedBookmark.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < bookmarks.length - 1;

  const goToPrev = useCallback(() => {
    const idx = bookmarks.findIndex((b) => b.id === selectedBookmark?.id);
    if (idx > 0) setSelectedBookmark(bookmarks[idx - 1]);
  }, [bookmarks, selectedBookmark]);

  const goToNext = useCallback(() => {
    const idx = bookmarks.findIndex((b) => b.id === selectedBookmark?.id);
    if (idx >= 0 && idx < bookmarks.length - 1)
      setSelectedBookmark(bookmarks[idx + 1]);
  }, [bookmarks, selectedBookmark]);

  const closeReader = useCallback(() => {
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

  const handleResetLocalData = useCallback(async () => {
    await resetLocalData();
    window.location.reload();
  }, []);

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks: bookmarks,
    closeReader,
    setSelectedBookmark,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readTweetId = params.get("read");
    if (!readTweetId || bookmarks.length === 0) return;
    const target = bookmarks.find((b) => b.tweetId === readTweetId);
    if (target) {
      openBookmark(target);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [bookmarks, openBookmark]);

  if (phase === "loading" || (isReady && syncState.phase === "idle")) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-x-bg">
        <div className="animate-pulse">
          <svg
            viewBox="0 0 24 24"
            className="w-12 h-12 text-x-blue"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
      </div>
    );
  }

  if (phase === "need_login" || phase === "connecting") {
    return <Onboarding phase={phase} onLogin={startLogin} />;
  }

  const mainContent = (() => {
    if (selectedBookmark) {
      return (
        <ReaderView
          bookmark={selectedBookmark}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={openBookmark}
          onBack={closeReader}
          onShuffle={() => setShuffleSeed((s) => s + 1)}
          onPrev={hasPrev ? goToPrev : undefined}
          onNext={hasNext ? goToNext : undefined}
          onUnbookmark={() => {
            unbookmark(selectedBookmark.tweetId);
            closeReader();
          }}
          themePreference={themePreference}
          onThemeChange={setThemePreference}
          onMarkAsRead={markAsRead}
        />
      );
    }
    if (view === "reading") {
      return (
        <ReadingView
          continueReadingItems={continueReading}
          unreadBookmarks={allUnread}
          syncing={syncState.phase === "syncing"}
          activeTab={readingTab}
          onTabChange={handleReadingTabChange}
          onOpenBookmark={openBookmark}
          onSync={refresh}
          onBack={() => setView("home")}
        />
      );
    }
    return (
      <NewTabHome
        bookmarks={bookmarks}
        detailedTweetIds={detailedTweetIds}
        showTopSites={settings.showTopSites}
        showSearchBar={settings.showSearchBar}
        topSitesLimit={settings.topSitesLimit}
        backgroundMode={settings.backgroundMode}
        openedTweetIds={openedTweetIds}
        onOpenBookmark={openBookmark}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReading={() => setView("reading")}
      />
    );
  })();

  return (
    <>
      {mainContent}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        bookmarks={bookmarks}
        onResetLocalData={handleResetLocalData}
      />
    </>
  );
}
