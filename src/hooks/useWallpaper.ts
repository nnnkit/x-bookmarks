import { useCallback, useEffect, useState } from "react";
import { asStringOrEmpty } from "../lib/json";

interface WallpaperImage {
  url: string;
  title: string;
}

interface WallpaperGalleryCache {
  images: WallpaperImage[];
  cachedAt: string; // local date YYYY-MM-DD
}

export interface UseWallpaperResult {
  wallpaperUrl: string | null;
  wallpaperTitle: string | null;
  loading: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  next: () => void;
  prev: () => void;
}

const STORAGE_KEY = "tw_wallpaper_cache_v5";

function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCache(value: unknown): WallpaperGalleryCache | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  const cachedAt = asStringOrEmpty(record.cachedAt);
  if (!cachedAt) return null;

  const rawImages = Array.isArray(record.images) ? record.images : [];
  const images: WallpaperImage[] = rawImages
    .map((img) => {
      if (!img || typeof img !== "object" || Array.isArray(img)) return null;
      const r = img as Record<string, unknown>;
      const url = asStringOrEmpty(r.url);
      if (!url) return null;
      return { url, title: asStringOrEmpty(r.title) };
    })
    .filter((img): img is WallpaperImage => img !== null);

  if (images.length === 0) return null;

  return { images, cachedAt };
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

async function fetchWallpaperViaServiceWorker(): Promise<WallpaperGalleryCache> {
  const { width, height } = wallpaperSizeForScreen();
  const response = await chrome.runtime.sendMessage({
    type: "FETCH_WALLPAPER",
    width,
    height,
  });

  if (response?.error) throw new Error(response.error);

  const rawImages = Array.isArray(response?.images) ? response.images : [];
  const images: WallpaperImage[] = rawImages
    .map((img: Record<string, unknown>) => {
      const url = asStringOrEmpty(img?.url);
      if (!url) return null;
      return { url, title: asStringOrEmpty(img?.title) };
    })
    .filter((img: WallpaperImage | null): img is WallpaperImage => img !== null);

  if (images.length === 0) throw new Error("No wallpaper images returned");

  return { images, cachedAt: todayLocal() };
}

export function useWallpaper(): UseWallpaperResult {
  const [gallery, setGallery] = useState<WallpaperImage[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        const cached = normalizeCache(stored[STORAGE_KEY]);

        if (cached && cached.cachedAt === todayLocal()) {
          if (!cancelled) {
            setGallery(cached.images);
            setIndex(0);
            setLoading(false);
          }
          return;
        }

        // Use stale cache while fetching fresh wallpaper.
        if (cached && !cancelled) {
          setGallery(cached.images);
          setIndex(0);
        }

        try {
          const fresh = await fetchWallpaperViaServiceWorker();
          await chrome.storage.local.set({ [STORAGE_KEY]: fresh });

          if (!cancelled) {
            setGallery(fresh.images);
            setIndex(0);
          }
        } catch {
          // Keep stale cache if available
        }
      } catch {
        // Fail silently.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = gallery[index] ?? null;

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, gallery.length - 1));
  }, [gallery.length]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  return {
    wallpaperUrl: current?.url ?? null,
    wallpaperTitle: current?.title ?? null,
    loading,
    hasNext: index < gallery.length - 1,
    hasPrev: index > 0,
    next,
    prev,
  };
}
