import { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "@ext/hooks/useTheme";
import { useSettings } from "@ext/hooks/useSettings";
import { useKeyboardNavigation } from "@ext/hooks/useKeyboard";
import { useContinueReading } from "@ext/hooks/useContinueReading";
import { pickRelatedBookmarks } from "@ext/lib/related";
import { NewTabHome } from "@ext/components/NewTabHome";
import { ReaderView } from "@ext/components/ReaderView";
import { ReadingView } from "@ext/components/ReadingView";
import { SettingsModal } from "@ext/components/SettingsModal";
import { DemoBanner } from "./DemoBanner";
import { MOCK_BOOKMARKS } from "../mock/bookmarks";
import { deleteBookmarksByTweetIds } from "@ext/db";
import type { Bookmark } from "@ext/types";

type AppView = "home" | "reading";

export default function DemoApp() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(MOCK_BOOKMARKS);
  const { themePreference, setThemePreference } = useTheme();
  const { settings, updateSettings } = useSettings();
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
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!selectedBookmark) return;
    const stillExists = bookmarks.some(
      (b) => b.tweetId === selectedBookmark.tweetId,
    );
    if (!stillExists) {
      setSelectedBookmark(null);
    }
  }, [bookmarks, selectedBookmark]);

  const relatedBookmarks = useMemo(
    () =>
      pickRelatedBookmarks(selectedBookmark, bookmarks, 3, shuffleSeed > 0),
    [selectedBookmark, bookmarks, shuffleSeed],
  );

  const openBookmark = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
  }, []);

  const closeReader = useCallback(() => {
    setSelectedBookmark(null);
    refreshContinueReading();
  }, [refreshContinueReading]);

  const handleSync = useCallback(() => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
  }, []);

  useKeyboardNavigation({
    selectedBookmark,
    filteredBookmarks: bookmarks,
    closeReader,
    setSelectedBookmark,
  });

  const mainContent = (() => {
    if (selectedBookmark) {
      return (
        <ReaderView
          bookmark={selectedBookmark}
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={openBookmark}
          onBack={closeReader}
          onShuffle={() => setShuffleSeed((s) => s + 1)}
        />
      );
    }
    if (view === "reading") {
      return (
        <ReadingView
          continueReadingItems={continueReading}
          unreadBookmarks={allUnread}
          onOpenBookmark={openBookmark}
          onBack={() => setView("home")}
        />
      );
    }
    return (
      <NewTabHome
        bookmarks={bookmarks}
        syncing={syncing}
        showTopSites={settings.showTopSites}
        showSearchBar={settings.showSearchBar}
        topSitesLimit={settings.topSitesLimit}
        onSync={handleSync}
        onOpenBookmark={openBookmark}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReading={() => setView("reading")}
      />
    );
  })();

  return (
    <>
      <DemoBanner />
      {mainContent}
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
