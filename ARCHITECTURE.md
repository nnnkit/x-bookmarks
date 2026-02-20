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

#### 1. Content Script (`public/content/detect-user.js`)
- Runs at `document_start` on `https://x.com/*`
- Reads `twid` cookie → extracts user ID
- Stores `current_user_id` in `chrome.storage.local`

#### 2. Background Service Worker (`public/service-worker.js`)
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
│   ├── rules.json              ← declarativeNetRequest: Origin header
│   ├── service-worker.js       ← Auth interception + API calls + GraphQL catalog
│   ├── content/
│   │   └── detect-user.js      ← Read twid cookie
│   └── wallpapers/             ← Built-in wallpaper images
├── src/
│   ├── main.tsx                ← React entry (new tab)
│   ├── popup.tsx               ← React entry (popup)
│   ├── App.tsx                 ← Main app with onboarding + bookmarks
│   ├── PopupApp.tsx            ← Extension popup app
│   ├── index.css               ← Tailwind
│   ├── api/
│   │   ├── core/
│   │   │   ├── auth.ts         ← Auth header management
│   │   │   ├── bookmarks.ts    ← Bookmark fetching via message passing
│   │   │   ├── posts.ts        ← Post detail fetching
│   │   │   └── index.ts        ← API barrel export
│   │   └── parsers.ts          ← Response parsing + normalization
│   ├── db/
│   │   └── index.ts            ← IndexedDB wrapper for bookmarks
│   ├── components/
│   │   ├── BookmarksList.tsx    ← Main bookmarks list view
│   │   ├── BookmarkReader.tsx   ← Inline tweet/article reader
│   │   ├── NewTabHome.tsx       ← New tab home layout
│   │   ├── Onboarding.tsx       ← Login detection + sync UI
│   │   ├── SearchBar.tsx        ← Search + filter
│   │   ├── SettingsModal.tsx    ← Settings dialog
│   │   ├── reader/              ← Tweet/article rendering components
│   │   └── popup/               ← Popup-specific components
│   ├── hooks/
│   │   ├── useAuth.ts           ← Auth state management
│   │   ├── useBookmarks.ts      ← Fetch + cache + paginate
│   │   ├── useContinueReading.ts← Reading progress tracking
│   │   ├── useSettings.ts       ← User settings
│   │   ├── useTheme.ts          ← Theme management
│   │   └── useWallpaper.ts      ← Wallpaper selection
│   ├── lib/                     ← Shared utilities
│   │   ├── bookmark-utils.ts    ← Title picking, reading time, etc.
│   │   ├── reconcile.ts         ← Bookmark merge/sync logic
│   │   ├── text.ts              ← Text formatting utilities
│   │   └── time.ts              ← Time formatting
│   └── types/
│       └── index.ts             ← TypeScript types
├── newtab.html
├── popup.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```
