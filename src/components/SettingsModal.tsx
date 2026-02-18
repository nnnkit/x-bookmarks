import { useEffect, useRef, useMemo } from "react";
import type {
  Bookmark,
  UserSettings,
} from "../types";
import type { ThemePreference } from "../hooks/useTheme";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  bookmarks: Bookmark[];
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  themePreference,
  onThemePreferenceChange,
  bookmarks,
}: SettingsModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const stats = useMemo(() => {
    const uniqueAuthors = new Set(bookmarks.map((b) => b.author.screenName));
    const withMedia = bookmarks.filter((b) => b.media.length > 0).length;
    const articles = bookmarks.filter(
      (b) => b.tweetKind === "article" || b.isThread,
    ).length;
    return {
      total: bookmarks.length,
      uniqueAuthors: uniqueAuthors.size,
      withMedia,
      articles,
    };
  }, [bookmarks]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="max-w-md mx-auto mt-[15vh] rounded-3xl border border-x-border bg-x-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 id="settings-title" className="text-xl font-bold text-x-text">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-full text-x-text-secondary hover:text-x-text hover:bg-x-hover transition-colors"
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Appearance */}
          <section>
            <h3 className="text-sm font-semibold text-x-text-secondary uppercase tracking-wider mb-3">
              Appearance
            </h3>
            <div className="flex rounded-xl border border-x-border overflow-hidden">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onThemePreferenceChange(opt.value)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    themePreference === opt.value
                      ? "bg-x-blue text-white"
                      : "text-x-text-secondary hover:text-x-text hover:bg-x-hover"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* New Tab */}
          <section>
            <h3 className="text-sm font-semibold text-x-text-secondary uppercase tracking-wider mb-3">
              New Tab
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-x-text">
                  Show search bar
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showSearchBar}
                  onClick={() =>
                    onUpdateSettings({
                      showSearchBar: !settings.showSearchBar,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.showSearchBar ? "bg-x-blue" : "bg-x-border"
                  }`}
                >
                  <span
                    className={`inline-block size-4 rounded-full bg-white transition-transform ${
                      settings.showSearchBar
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-x-text">
                  Show quick links
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showTopSites}
                  onClick={() =>
                    onUpdateSettings({
                      showTopSites: !settings.showTopSites,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.showTopSites ? "bg-x-blue" : "bg-x-border"
                  }`}
                >
                  <span
                    className={`inline-block size-4 rounded-full bg-white transition-transform ${
                      settings.showTopSites
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {settings.showTopSites && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-x-text-secondary">
                    Max quick links
                  </span>
                  <select
                    value={settings.topSitesLimit}
                    onChange={(e) =>
                      onUpdateSettings({
                        topSitesLimit: Number(e.target.value),
                      })
                    }
                    className="rounded-lg border border-x-border bg-x-bg px-2.5 py-1.5 text-sm text-x-text focus:border-x-blue focus:outline-none transition-colors"
                  >
                    {[3, 4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          </section>

          {/* Stats */}
          <section>
            <h3 className="text-sm font-semibold text-x-text-secondary uppercase tracking-wider mb-3">
              Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-x-border bg-x-bg p-3">
                <p className="text-2xl font-bold text-x-text tabular-nums">
                  {stats.total}
                </p>
                <p className="text-xs text-x-text-secondary mt-0.5">
                  Bookmarks
                </p>
              </div>
              <div className="rounded-xl border border-x-border bg-x-bg p-3">
                <p className="text-2xl font-bold text-x-text tabular-nums">
                  {stats.uniqueAuthors}
                </p>
                <p className="text-xs text-x-text-secondary mt-0.5">
                  Unique authors
                </p>
              </div>
              <div className="rounded-xl border border-x-border bg-x-bg p-3">
                <p className="text-2xl font-bold text-x-text tabular-nums">
                  {stats.withMedia}
                </p>
                <p className="text-xs text-x-text-secondary mt-0.5">
                  With media
                </p>
              </div>
              <div className="rounded-xl border border-x-border bg-x-bg p-3">
                <p className="text-2xl font-bold text-x-text tabular-nums">
                  {stats.articles}
                </p>
                <p className="text-xs text-x-text-secondary mt-0.5">
                  Articles & threads
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-x-border px-6 py-4">
          <p className="text-xs text-x-text-secondary text-center">
            Settings sync across your devices
          </p>
        </div>
      </div>
    </div>
  );
}
