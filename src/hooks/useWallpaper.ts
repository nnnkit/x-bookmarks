import { useEffect, useState } from "react";
import type { WallpaperSource } from "../types";

interface WallpaperCache {
  url: string;
  title: string;
  cachedAt: string; // UTC date string YYYY-MM-DD
  provider: WallpaperSource;
}

interface WallpaperCacheStore {
  bing?: WallpaperCache;
  wikimedia?: WallpaperCache;
}

interface UseWallpaperResult {
  wallpaperUrl: string | null;
  wallpaperTitle: string | null;
  loading: boolean;
}

const STORAGE_KEY = "tw_wallpaper_cache_v3";
const BING_ENDPOINT = "https://www.bing.com/HPImageArchive.aspx";
const WIKIMEDIA_ENDPOINT = "https://en.wikipedia.org/api/rest_v1/feed/featured";

const PROVIDER_FALLBACK_ORDER: Record<WallpaperSource, WallpaperSource[]> = {
  bing: ["bing", "wikimedia"],
  wikimedia: ["wikimedia", "bing"],
};

function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeCache(
  value: unknown,
  fallbackProvider: WallpaperSource,
): WallpaperCache | null {
  const record = toRecord(value);
  if (!record) return null;

  const url = toString(record.url);
  const cachedAt = toString(record.cachedAt);
  if (!url || !cachedAt) return null;

  const providerRaw = toString(record.provider);
  const provider: WallpaperSource =
    providerRaw === "bing" || providerRaw === "wikimedia"
      ? providerRaw
      : fallbackProvider;

  return {
    url,
    title: toString(record.title),
    cachedAt,
    provider,
  };
}

function normalizeCacheStore(value: unknown): WallpaperCacheStore {
  const record = toRecord(value);
  if (!record) return {};

  // Legacy cache migration: previous versions stored a single object.
  if (!record.bing && !record.wikimedia) {
    const legacy = normalizeCache(record, "bing");
    return legacy ? { bing: legacy } : {};
  }

  const store: WallpaperCacheStore = {};
  const bing = normalizeCache(record.bing, "bing");
  const wikimedia = normalizeCache(record.wikimedia, "wikimedia");
  if (bing) store.bing = bing;
  if (wikimedia) store.wikimedia = wikimedia;
  return store;
}

function wallpaperSizeForScreen() {
  const ratio = Math.max(
    1,
    Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
  );

  if (typeof window === "undefined") {
    return { width: 1920, height: 1080 };
  }

  const width = Math.min(
    3840,
    Math.max(1920, Math.round(window.screen.width * ratio)),
  );
  const height = Math.min(
    2160,
    Math.max(1080, Math.round(window.screen.height * ratio)),
  );
  return { width, height };
}

function utcDatePath() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function pickBingImage(
  images: unknown[],
  previousUrl: string | null,
): Record<string, unknown> | null {
  const normalizedPreviousUrl =
    typeof previousUrl === "string" && previousUrl
      ? previousUrl
      : null;

  const records = images
    .map((value) => toRecord(value))
    .filter((value): value is Record<string, unknown> => Boolean(value));

  if (!records.length) return null;

  if (!normalizedPreviousUrl) return records[0];

  for (const record of records) {
    const rawUrl = toString(record.url);
    const absoluteUrl = rawUrl.startsWith("http")
      ? rawUrl
      : `https://www.bing.com${rawUrl}`;
    if (absoluteUrl !== normalizedPreviousUrl) return record;
  }

  return records[0];
}

async function fetchBingWallpaper(
  previousUrl: string | null,
): Promise<WallpaperCache> {
  const { width, height } = wallpaperSizeForScreen();
  const params = new URLSearchParams({
    format: "js",
    idx: "0",
    n: "8",
    mkt: "en-US",
    uhd: "1",
    uhdwidth: String(width),
    uhdheight: String(height),
  });

  const res = await fetch(`${BING_ENDPOINT}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bing API ${res.status}`);

  const data = toRecord(await res.json());
  const images = Array.isArray(data?.images) ? data.images : [];
  const image = pickBingImage(images, previousUrl);

  const rawUrl = toString(image?.url);
  if (!rawUrl) throw new Error("Bing API missing image URL");

  return {
    url: rawUrl.startsWith("http") ? rawUrl : `https://www.bing.com${rawUrl}`,
    title: toString(image?.copyright) || "Bing daily wallpaper",
    cachedAt: todayLocal(),
    provider: "bing",
  };
}

async function fetchWikimediaWallpaper(): Promise<WallpaperCache> {
  const res = await fetch(`${WIKIMEDIA_ENDPOINT}/${utcDatePath()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wikimedia API ${res.status}`);

  const data = toRecord(await res.json());
  const image = toRecord(data?.image);
  const fullImage = toRecord(image?.image);
  const thumbnail = toRecord(image?.thumbnail);

  const url = toString(fullImage?.source) || toString(thumbnail?.source);
  if (!url) throw new Error("Wikimedia API missing image URL");

  const description = toRecord(image?.description);

  return {
    url,
    title:
      toString(description?.text) ||
      toString(image?.title) ||
      "Wikimedia featured image",
    cachedAt: todayLocal(),
    provider: "wikimedia",
  };
}

async function fetchWallpaper(
  provider: WallpaperSource,
  previousUrl: string | null,
): Promise<WallpaperCache> {
  return provider === "bing"
    ? fetchBingWallpaper(previousUrl)
    : fetchWikimediaWallpaper();
}

export function useWallpaper(source: WallpaperSource): UseWallpaperResult {
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [wallpaperTitle, setWallpaperTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        const cacheStore = normalizeCacheStore(stored[STORAGE_KEY]);
        const cached = cacheStore[source];

        if (cached && cached.cachedAt === todayLocal()) {
          if (!cancelled) {
            setWallpaperUrl(cached.url);
            setWallpaperTitle(cached.title);
            setLoading(false);
          }
          return;
        }

        // Use stale cache while fetching fresh wallpaper.
        if (cached && !cancelled) {
          setWallpaperUrl(cached.url);
          setWallpaperTitle(cached.title);
        }

        for (const provider of PROVIDER_FALLBACK_ORDER[source]) {
          try {
            const fresh = await fetchWallpaper(provider, cached?.url ?? null);
            const nextCacheStore: WallpaperCacheStore = {
              ...cacheStore,
              [source]: fresh,
              [provider]: fresh,
            };
            await chrome.storage.local.set({ [STORAGE_KEY]: nextCacheStore });

            if (!cancelled) {
              setWallpaperUrl(fresh.url);
              setWallpaperTitle(fresh.title);
            }
            return;
          } catch {
            // try next provider
          }
        }
      } catch {
        // Keep stale cache (if available) and fail silently.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, [source]);

  return { wallpaperUrl, wallpaperTitle, loading };
}
