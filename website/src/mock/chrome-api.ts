type StorageChange = { oldValue?: unknown; newValue?: unknown };
type StorageChangeCallback = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

const globalListeners = new Set<StorageChangeCallback>();
const areaListeners: Record<string, Set<StorageChangeCallback>> = {
  local: new Set(),
  sync: new Set(),
};

function fireChanges(
  changes: Record<string, StorageChange>,
  areaName: string,
) {
  for (const cb of globalListeners) {
    try {
      cb(changes, areaName);
    } catch {
      // ignore listener errors
    }
  }
  for (const cb of areaListeners[areaName] ?? []) {
    try {
      cb(changes, areaName);
    } catch {
      // ignore listener errors
    }
  }
}

function createStorageArea(prefix: string, areaName: string) {
  return {
    async get(
      keys?: string | string[] | Record<string, unknown> | null,
    ): Promise<Record<string, unknown>> {
      if (keys === null || keys === undefined) {
        const result: Record<string, unknown> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const raw = localStorage.key(i);
          if (raw?.startsWith(prefix)) {
            const key = raw.slice(prefix.length);
            try {
              result[key] = JSON.parse(localStorage.getItem(raw)!);
            } catch {
              // skip unparseable
            }
          }
        }
        return result;
      }

      if (typeof keys === "string") {
        const raw = localStorage.getItem(prefix + keys);
        return raw !== null ? { [keys]: JSON.parse(raw) } : {};
      }

      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          const raw = localStorage.getItem(prefix + key);
          if (raw !== null) {
            try {
              result[key] = JSON.parse(raw);
            } catch {
              // skip
            }
          }
        }
        return result;
      }

      // Object with defaults
      const result: Record<string, unknown> = {};
      for (const [key, defaultValue] of Object.entries(keys)) {
        const raw = localStorage.getItem(prefix + key);
        result[key] = raw !== null ? JSON.parse(raw) : defaultValue;
      }
      return result;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      const changes: Record<string, StorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        const oldRaw = localStorage.getItem(prefix + key);
        const oldValue =
          oldRaw !== null ? JSON.parse(oldRaw) : undefined;
        localStorage.setItem(prefix + key, JSON.stringify(value));
        changes[key] = { oldValue, newValue: value };
      }
      fireChanges(changes, areaName);
    },

    async remove(keys: string | string[]): Promise<void> {
      const arr = typeof keys === "string" ? [keys] : keys;
      const changes: Record<string, StorageChange> = {};
      for (const key of arr) {
        const oldRaw = localStorage.getItem(prefix + key);
        if (oldRaw !== null) {
          changes[key] = { oldValue: JSON.parse(oldRaw) };
          localStorage.removeItem(prefix + key);
        }
      }
      if (Object.keys(changes).length > 0) {
        fireChanges(changes, areaName);
      }
    },

    onChanged: {
      addListener(cb: StorageChangeCallback) {
        areaListeners[areaName].add(cb);
      },
      removeListener(cb: StorageChangeCallback) {
        areaListeners[areaName].delete(cb);
      },
    },
  };
}

async function handleRuntimeMessage(
  message: Record<string, unknown>,
): Promise<unknown> {
  switch (message.type) {
    case "CHECK_AUTH":
      return {
        hasUser: true,
        hasAuth: true,
        hasQueryId: true,
        userId: "demo_user",
      };
    case "START_AUTH_CAPTURE":
    case "CLOSE_AUTH_TAB":
      return {};
    case "REAUTH_STATUS":
      return { inProgress: false };
    case "DELETE_BOOKMARK":
      return {};
    case "GET_BOOKMARK_EVENTS":
      return { data: { events: [] } };
    case "ACK_BOOKMARK_EVENTS":
      return {};
    case "FETCH_BOOKMARKS":
      return { data: null };
    case "FETCH_TWEET_DETAIL":
      return { data: null };
    default:
      return {};
  }
}

const TOP_SITES = [
  { title: "Google", url: "https://www.google.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "GitHub", url: "https://github.com" },
  { title: "X", url: "https://x.com" },
  { title: "Reddit", url: "https://www.reddit.com" },
  { title: "Wikipedia", url: "https://en.wikipedia.org" },
  { title: "Amazon", url: "https://www.amazon.com" },
  { title: "Netflix", url: "https://www.netflix.com" },
];

export function createMockChrome() {
  return {
    storage: {
      local: createStorageArea("__xbt_local_", "local"),
      sync: createStorageArea("__xbt_sync_", "sync"),
      onChanged: {
        addListener(cb: StorageChangeCallback) {
          globalListeners.add(cb);
        },
        removeListener(cb: StorageChangeCallback) {
          globalListeners.delete(cb);
        },
      },
    },
    runtime: {
      sendMessage: handleRuntimeMessage,
      id: "demo-extension-id",
    },
    topSites: {
      async get() {
        return TOP_SITES;
      },
    },
  };
}
