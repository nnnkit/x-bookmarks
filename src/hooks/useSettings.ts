import { useEffect, useState } from "react";
import type { UserSettings } from "../types";
import { hasChromeStorageSync, hasChromeStorageOnChanged } from "../lib/chrome";

const SETTINGS_KEY = "ui_settings";

const DEFAULT_SETTINGS: UserSettings = {
  showTopSites: false,
  showSearchBar: true,
  topSitesLimit: 5,
};

function normalizeSettings(value: unknown): UserSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Record<string, unknown>;
  return {
    showTopSites:
      typeof raw.showTopSites === "boolean"
        ? raw.showTopSites
        : DEFAULT_SETTINGS.showTopSites,
    showSearchBar:
      typeof raw.showSearchBar === "boolean"
        ? raw.showSearchBar
        : DEFAULT_SETTINGS.showSearchBar,
    topSitesLimit:
      typeof raw.topSitesLimit === "number" &&
      raw.topSitesLimit >= 1 &&
      raw.topSitesLimit <= 10
        ? raw.topSitesLimit
        : DEFAULT_SETTINGS.topSitesLimit,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!hasChromeStorageSync()) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const stored = await chrome.storage.sync.get({
          [SETTINGS_KEY]: DEFAULT_SETTINGS,
        });
        if (!cancelled) {
          setSettings(normalizeSettings(stored[SETTINGS_KEY]));
        }
      } catch {
        // fallback to defaults
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hasChromeStorageSync()) return;
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }).catch(() => {});
  }, [settings, ready]);

  useEffect(() => {
    if (!hasChromeStorageOnChanged()) return;

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      const change = changes[SETTINGS_KEY];
      if (!change) return;
      setSettings(normalizeSettings(change.newValue));
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  const updateSettings = (patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return { settings, updateSettings };
}
