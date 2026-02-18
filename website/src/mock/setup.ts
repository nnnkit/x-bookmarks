import { createMockChrome } from "./chrome-api";

// Install chrome polyfill immediately (side-effect module)
if (
  typeof window !== "undefined" &&
  !((window as unknown as Record<string, unknown>).chrome as Record<string, unknown>)
    ?.storage
) {
  (window as unknown as Record<string, unknown>).chrome = createMockChrome();
}

// Pre-seed wallpaper cache so useWallpaper doesn't try to fetch from Bing (CORS)
const WALLPAPER_KEY = "tw_wallpaper_cache_v5";
const LS_PREFIX = "__xbt_local_";
const existing = localStorage.getItem(LS_PREFIX + WALLPAPER_KEY);

if (!existing) {
  const now = new Date();
  const cachedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const wallpaperCache = {
    images: [
      {
        url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80",
        title: "Yosemite Valley, California",
      },
      {
        url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80",
        title: "Mountain sunrise over the valley",
      },
      {
        url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80",
        title: "Foggy forest trail at dawn",
      },
      {
        url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80",
        title: "Sunlight through forest canopy",
      },
      {
        url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80",
        title: "Rolling green hills at sunset",
      },
    ],
    cachedAt,
  };

  localStorage.setItem(
    LS_PREFIX + WALLPAPER_KEY,
    JSON.stringify(wallpaperCache),
  );
}
