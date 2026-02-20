import { useMemo, useState } from "react";
import { Monitor, Moon, Sun, X } from "@phosphor-icons/react";
import type { Bookmark, UserSettings } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  bookmarks: Bookmark[];
  onResetLocalData: () => Promise<void>;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: "monitor" | "sun" | "moon" }[] = [
  { value: "system", label: "Auto", icon: "monitor" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  themePreference,
  onThemePreferenceChange,
  bookmarks,
  onResetLocalData,
}: Props) {
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const uniqueAuthors = new Set<string>();
    let withMedia = 0;
    let articles = 0;
    for (const b of bookmarks) {
      uniqueAuthors.add(b.author.screenName);
      if (b.media.length > 0) withMedia++;
      if (b.tweetKind === "article" || b.isThread) articles++;
    }
    return {
      total: bookmarks.length,
      uniqueAuthors: uniqueAuthors.size,
      withMedia,
      articles,
    };
  }, [bookmarks]);

  const handleResetLocalData = async () => {
    if (resetting) return;

    const confirmed = window.confirm(
      "Reset local data on this device? This clears cached bookmarks and requires manual login before sync.",
    );
    if (!confirmed) return;

    setResetError(null);
    setResetting(true);

    try {
      await onResetLocalData();
    } catch {
      setResetError("Reset failed. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="bg-black/50 backdrop-blur-sm" ariaLabelledBy="settings-title">
      {(closing) => (
      <div className={cn(
        "max-w-md mx-auto mt-[15vh] rounded-3xl border border-x-border bg-x-card shadow-2xl",
        closing ? "animate-preview-out" : "animate-preview-in",
      )}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 id="settings-title" className="text-xl font-bold text-x-text">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-full text-x-text-secondary hover:text-x-text hover:bg-x-hover transition-colors"
            aria-label="Close settings"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
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
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                    themePreference === opt.value
                      ? "bg-x-blue text-white"
                      : "text-x-text-secondary hover:text-x-text hover:bg-x-hover",
                  )}
                >
                  {opt.icon === "monitor" ? (
                    <Monitor className="size-4" />
                  ) : opt.icon === "sun" ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <BackgroundSettings
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />

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
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.showSearchBar ? "bg-x-blue" : "bg-x-border",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 rounded-full bg-white transition-transform",
                      settings.showSearchBar ? "translate-x-6" : "translate-x-1",
                    )}
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
                  onClick={async () => {
                    if (!settings.showTopSites) {
                      try {
                        const granted = await chrome.permissions.request({
                          permissions: ["topSites", "favicon"],
                        });
                        if (!granted) return;
                      } catch {
                        return;
                      }
                    }
                    onUpdateSettings({
                      showTopSites: !settings.showTopSites,
                    });
                  }}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.showTopSites ? "bg-x-blue" : "bg-x-border",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 rounded-full bg-white transition-transform",
                      settings.showTopSites ? "translate-x-6" : "translate-x-1",
                    )}
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

          <section>
            <h3 className="text-sm font-semibold text-x-text-secondary uppercase tracking-wider mb-3">
              Data
            </h3>
            <p className="text-sm text-x-text-secondary mb-3">
              Clear local IndexedDB and session state for this device.
            </p>
            <button
              type="button"
              onClick={handleResetLocalData}
              disabled={resetting}
              className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
            >
              {resetting ? "Resetting..." : "Reset local data"}
            </button>
            {resetError ? (
              <p className="text-xs text-red-300 mt-2">
                {resetError}
              </p>
            ) : null}
          </section>
        </div>

        <div className="border-t border-x-border px-6 py-4">
          <p className="text-xs text-x-text-secondary text-center">
            Settings sync across your devices
          </p>
        </div>
      </div>
      )}
    </Modal>
  );
}

interface BackgroundSettingsProps {
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
}

const BACKGROUND_OPTIONS: { value: UserSettings["backgroundMode"]; label: string }[] = [
  { value: "gradient", label: "Gradient" },
  { value: "images", label: "Images" },
];

function BackgroundSettings({ settings, onUpdateSettings }: BackgroundSettingsProps) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-x-text-secondary uppercase tracking-wider mb-3">
        Background
      </h3>
      <div className="flex rounded-xl border border-x-border overflow-hidden">
        {BACKGROUND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onUpdateSettings({ backgroundMode: opt.value })}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              settings.backgroundMode === opt.value
                ? "bg-x-blue text-white"
                : "text-x-text-secondary hover:text-x-text hover:bg-x-hover",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
