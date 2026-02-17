import { useCallback, useEffect, useState } from "react";

export interface TopSite {
  title: string;
  url: string;
  hostname: string;
  faviconUrl: string;
}

export function useTopSites(limit = 8) {
  const [sites, setSites] = useState<TopSite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSites = useCallback(async () => {
    if (!chrome.topSites?.get) {
      setLoading(false);
      return;
    }

    try {
      const raw = await chrome.topSites.get();
      const mapped: TopSite[] = raw.slice(0, limit).map((s) => {
        const hostname = new URL(s.url).hostname;
        return {
          title: s.title || hostname,
          url: s.url,
          hostname,
          faviconUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
        };
      });
      setSites(mapped);
    } catch {
      // topSites unavailable
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchSites();

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchSites();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchSites]);

  return { sites, loading };
}
