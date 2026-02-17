import { useEffect, useState } from "react";
import type { UserSettings } from "../types";

const SETTINGS_KEY = "ui_settings";

const VALID_WIDGET_STYLES = new Set(["stack", "swiper", "filmstrip"]);
const VALID_WALLPAPER_SOURCES = new Set(["bing", "wikimedia"]);

const DEFAULT_SETTINGS: UserSettings = {
  showBookmarkStack: true,
  stackSize: 5,
  showTopSites: false,
  widgetStyle: "stack",
  wallpaperSource: "bing",
};

function hasChromeStorageSync() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.sync);
}

function hasChromeStorageOnChanged() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.onChanged);
}

function normalizeSettings(value: unknown): UserSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Record<string, unknown>;
  return {
    showBookmarkStack:
      typeof raw.showBookmarkStack === "boolean"
        ? raw.showBookmarkStack
        : DEFAULT_SETTINGS.showBookmarkStack,
    stackSize:
      typeof raw.stackSize === "number" &&
      raw.stackSize >= 3 &&
      raw.stackSize <= 10
        ? raw.stackSize
        : DEFAULT_SETTINGS.stackSize,
    showTopSites:
      typeof raw.showTopSites === "boolean"
        ? raw.showTopSites
        : DEFAULT_SETTINGS.showTopSites,
    widgetStyle:
      typeof raw.widgetStyle === "string" &&
      VALID_WIDGET_STYLES.has(raw.widgetStyle as string)
        ? (raw.widgetStyle as UserSettings["widgetStyle"])
        : DEFAULT_SETTINGS.widgetStyle,
    wallpaperSource:
      typeof raw.wallpaperSource === "string" &&
      VALID_WALLPAPER_SOURCES.has(raw.wallpaperSource as string)
        ? (raw.wallpaperSource as UserSettings["wallpaperSource"])
        : DEFAULT_SETTINGS.wallpaperSource,
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
