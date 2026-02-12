# X Bookmarks Tab — Architecture

## Lessons from Twillot

### Why their approach works
1. **Content script** reads the `twid` cookie at `document_start` — instant login detection
2. **`declarativeNetRequest`** sets `Origin: https://x.com` on all GraphQL requests — bypasses CORS
3. **Background service worker** intercepts auth headers from real x.com requests
4. **IndexedDB** stores bookmarks (better than chrome.storage for large datasets)
5. **Async generator** for sync — progressive UI updates as pages arrive
6. **Per-user scoped storage** — supports multiple X accounts

### Critical missing piece from our v1
We didn't have the `declarativeNetRequest` rule. Without `Origin: https://x.com` header, Twitter's API rejects requests from `chrome-extension://` origins.

---

## Architecture

### Flow

```
[Install] → [User visits x.com] → [Content script reads twid cookie]
                                 → [Background intercepts auth headers]
                                 → [Open new tab → detect login → sync → display]
```

### Components

#### 1. Content Script (`src/content/detect-user.ts`)
- Runs at `document_start` on `https://x.com/*`
- Reads `twid` cookie → extracts user ID
- Stores `current_user_id` in `chrome.storage.local`

#### 2. Background Service Worker (`src/background/service-worker.ts`)
- `chrome.webRequest.onSendHeaders` — captures auth headers from x.com GraphQL requests
- `chrome.runtime.onMessage` — handles FETCH_BOOKMARKS, CHECK_STATUS messages
- Makes actual API calls (can set Cookie header unlike extension pages)

#### 3. Declarative Net Request Rule (`public/rules.json`)
- Sets `Origin: https://x.com` on all `x.com/i/api/graphql/*` requests
- This is what makes API calls from the extension work

#### 4. New Tab Page (React)
- Checks login status (user ID + auth headers exist?)
- Onboarding: "Visit x.com to connect" → auto-detects when ready
- Sync engine: fetches all bookmarks with pagination
- Display: inline reading, search, media preview

### Storage

| Store | What | Why |
|-------|------|-----|
| `chrome.storage.local` | Auth headers, user ID, sync cursor, settings | Accessible from all contexts |
| IndexedDB (`xbt`) | Bookmarks data | Better for 1000s of records, indexed queries |

### Manifest V3 Permissions

```json
{
  "permissions": ["cookies", "storage", "webRequest", "declarativeNetRequest"],
  "host_permissions": ["https://x.com/*"],
  "content_scripts": [{ "matches": ["https://x.com/*"], "run_at": "document_start" }],
  "background": { "service_worker": "service-worker.js" },
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "declarative_net_request": { "rule_resources": [{ "id": "rules", "path": "rules.json" }] }
}
```

### File Structure

```
x-bookmarks-tab/
├── public/
│   ├── manifest.json
│   └── rules.json              ← declarativeNetRequest: Origin header
├── src/
│   ├── main.tsx                ← React entry
│   ├── App.tsx                 ← Main app with onboarding + bookmarks
│   ├── index.css               ← Tailwind
│   ├── background/
│   │   └── service-worker.ts   ← Auth interception + API calls
│   ├── content/
│   │   └── detect-user.ts      ← Read twid cookie
│   ├── api/
│   │   ├── twitter.ts          ← Bookmark fetching via message passing
│   │   └── features.ts         ← GraphQL feature flags
│   ├── db/
│   │   └── index.ts            ← IndexedDB wrapper for bookmarks
│   ├── components/
│   │   ├── Onboarding.tsx      ← Login detection + sync UI
│   │   ├── BookmarkCard.tsx    ← Inline tweet reading
│   │   ├── SearchBar.tsx       ← Search + filter
│   │   └── SyncProgress.tsx    ← Sync progress indicator
│   ├── hooks/
│   │   ├── useBookmarks.ts     ← Fetch + cache + paginate
│   │   └── useAuth.ts          ← Auth state management
│   └── types/
│       └── index.ts            ← TypeScript types
├── newtab.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```
