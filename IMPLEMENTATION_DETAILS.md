# How Twitter/X Bookmark Extensions Work — Complete Implementation Reference

Verified line-by-line against the [twillot monorepo](https://github.com/twillot-app/twillot) source code (`twitter-bookmarks-search/`).

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Bookmark CRUD Operations](#2-bookmark-crud-operations)
3. [Bookmark Sync Engine](#3-bookmark-sync-engine)
4. [Tweet Parsing & Normalization](#4-tweet-parsing--normalization)
5. [Bookmark Folders](#5-bookmark-folders)
6. [Search & Filtering](#6-search--filtering)
7. [Thread Detection](#7-thread-detection)
8. [Media Handling](#8-media-handling)
9. [URL & Link Handling](#9-url--link-handling)
10. [Long-Form Tweets (note_tweet)](#10-long-form-tweets-note_tweet)
11. [Quote Tweets](#11-quote-tweets)
12. [Real-Time Bookmark Detection](#12-real-time-bookmark-detection)
13. [Export](#13-export)
14. [AI Auto-Organizing](#14-ai-auto-organizing)
15. [IndexedDB Schema](#15-indexeddb-schema)
16. [Rate Limiting & Error Handling](#16-rate-limiting--error-handling)
17. [Transaction ID Rotation](#17-transaction-id-rotation)
18. [Feature Flags](#18-feature-flags)
19. [CORS & Origin Spoofing](#19-cors--origin-spoofing)
20. [Architecture & Permissions](#20-architecture--permissions)
21. [API Endpoint Reference](#21-api-endpoint-reference)
22. [Sample Data Structures](#22-sample-data-structures)

---

## 1. Authentication

Authentication uses two complementary mechanisms — passive cookie reading and header interception — with no visible login UI.

### 1A. Reading the `twid` Cookie (Content Script)

**File:** `x-bookmarks/src/contentScript/index.ts` (lines 3–9)

```ts
for (const item of document.cookie.split(';')) {
  const [key, value] = item.split('=')
  if (key.includes('twid')) {
    setCurrentUserId(value.replace('u%3D', ''))
    break
  }
}
```

- The `twid` cookie is set by X when a user logs in.
- Its value is URL-encoded: `u%3D123456789` → decoded: `u=123456789`.
- The numeric user ID is extracted and stored in `chrome.storage.local` as `current_user_id`.
- This runs at `document_start` on every `x.com` page — it fires before the page even renders.

### 1B. Intercepting Auth Headers (Background Service Worker)

**File:** `x-bookmarks/src/background/index.ts` (lines 9–40)

```ts
chrome.webRequest.onSendHeaders.addListener(
  async (details) => {
    const { url, initiator } = details
    // Only listen to requests from x.com itself — prevents re-intercepting our own requests
    if (initiator !== Host) return

    // Only care about Bookmark-related GraphQL endpoints
    if (!url.includes('/Bookmarks') && !url.includes('/BookmarkFoldersSlice')) return

    await syncAuthHeaders(details.requestHeaders)
  },
  {
    types: ['xmlhttprequest'],
    urls: [`${Host}/i/api/graphql/*`],
  },
  ['requestHeaders'],
)
```

**Key detail:** The `initiator` check (`initiator !== 'https://x.com'`) is critical — it prevents the extension from intercepting its own API requests, which would cause an infinite loop of credential rotation.

### 1C. Headers Captured

**File:** `packages/utils/storage.ts` (lines 180–228) — `syncAuthHeaders()`

Four headers are extracted from X's own Bookmarks API requests:

| Header | Storage Key | Purpose |
|--------|-------------|---------|
| `authorization` | `token` | Bearer token (e.g., `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAEA...`) |
| `x-csrf-token` | `csrf` | CSRF token (matches the `ct0` cookie) |
| `x-client-uuid` | `uuid` | Device identifier (optional — present on Edge, missing on Chrome) |
| `x-client-transaction-id` | `transaction_id` | Per-request ID that gets rotated (see [Section 17](#17-transaction-id-rotation)) |

All headers must be present (except `uuid`) or the auth is considered incomplete:

```ts
if (!csrf || !token || !transaction_id) {
  console.log('syncAuthHeaders: missing headers', { csrf, token, uuid, transaction_id })
  return
}
```

### 1D. Multi-User Storage Scoping

**File:** `packages/utils/storage.ts` (lines 25–35)

All storage keys are namespaced per user: `user:{userId}:{key}`. This prevents credential leaks when switching between X accounts:

```ts
export function getStorageKey(key: string, user_id: string) {
  if (!user_id) return key
  if (key === StorageKeys.Current_UID) return key // global key, not scoped
  return `user:${user_id}:${key}`
}
```

### 1E. Re-Authentication Flow

**File:** `packages/utils/hooks/useAuth.tsx` (lines 28–36)

When credentials expire or are missing:

```ts
const startAuth = async () => {
  await logout(await getCurrentUserId())        // Clear stale tokens
  const authed = await checkAuth()
  if (authed) return                             // Already good
  setIsAuthenicating(true)
  // Open x.com/i/bookmarks in a BACKGROUND tab (active: false)
  tab = await openNewTab(ActionPage.AUTHENTICATE, false)
  // Poll every 3 seconds until credentials appear in storage
  timerId = setInterval(checkAuth, 3000)
}
```

**How it works:** When X loads in the background tab and the user is logged in, X's web app makes its own Bookmarks API call. The `webRequest.onSendHeaders` listener intercepts those headers. Once `auth.token` is truthy, polling stops and the tab is closed.

**`ActionPage.AUTHENTICATE`** = `https://x.com/i/bookmarks?twillot=reauth` — the `?twillot=reauth` query param has no effect on X's behavior; it's just a marker for debugging.

### 1F. Authentication Check

**File:** `packages/utils/storage.ts` (lines 154–173)

```ts
export async function getAuthInfo() {
  const keys = [StorageKeys.Token, StorageKeys.Csrf, StorageKeys.Uuid,
                StorageKeys.Transaction_Id, StorageKeys.Bookmark_Cursor]
  let auth = await getLocal(keys)
  if (auth && auth.transaction_id) {
    auth.transaction_id = incrementFirstNumber(auth.transaction_id) // Rotate each call
  }
  return auth
}
```

User is authenticated when `auth.token` is truthy.

### 1G. Logout

**File:** `packages/utils/storage.ts` (lines 73–83)

```ts
export async function logout(user_id: string) {
  const keys = [StorageKeys.Csrf, StorageKeys.Token]
  await chrome.storage.local.remove(keys.map(key => getStorageKey(key, user_id)))
}
```

Only removes `csrf` and `token` — keeps the `current_user_id` and `bookmark_cursor` so the user doesn't lose sync progress.

---

## 2. Bookmark CRUD Operations

### 2A. Fetch Bookmarks (GET)

**File:** `packages/utils/api/twitter.ts` (lines 207–234)

```ts
export async function getBookmarks(cursor?: string) {
  const variables = {
    cursor: '',
    count: 100,                    // Max 100 per page
    includePromotedContent: true,
  }
  if (cursor) variables.cursor = cursor

  const query = flatten({
    variables,
    features: BOOKMARK_FEATURES,   // Extends COMMON_FEATURES + graphql_timeline_v2_bookmark_timeline: true
  })

  const json = await request(`${Endpoint.LIST_BOOKMARKS}?${query}`, {
    body: null,
    method: 'GET',
  })
  return json as BookmarksResponse
}
```

**Endpoint:** `GET https://x.com/i/api/graphql/UyNF_BgJ5d5MbtuVukyl7A/Bookmarks`

Error handling wraps `IdentityError` for non-timeout, non-data errors — signaling the caller that re-auth is needed.

### 2B. Delete Bookmark (POST)

**File:** `packages/utils/api/twitter.ts` (lines 195–205)

```ts
export async function deleteBookmark(tweetId: string) {
  return request(Endpoint.DELETE_BOOKMARK, {
    method: 'POST',
    body: JSON.stringify({
      variables: { tweet_id: tweetId },
      queryId: EndpointQuery.DELETE_BOOKMARK,
    }),
  })
}
```

**Endpoint:** `POST https://x.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark`

### 2C. Create Tweet (POST)

**File:** `packages/utils/api/twitter.ts` (lines 142–181)

Supports two modes:
1. **Simple mode:** Just `text` and optional `replyTweetId`
2. **Custom mode:** Full `variables` object for advanced use (e.g., with pre-uploaded media)

```ts
export async function createTweet(args) {
  if ('variables' in args) {
    return request(getEndpoint(args.queryId, 'CreateTweet'), {
      body: JSON.stringify(args),
    })
  }
  const variables = {
    tweet_text: text,
    dark_request: false,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: [],
  }
  if (replyTweetId) {
    variables['reply'] = {
      in_reply_to_tweet_id: replyTweetId,
      exclude_reply_user_ids: [],
    }
  }
  return request(Endpoint.CREATE_TWEET, {
    body: JSON.stringify({ queryId: EndpointQuery.CREATE_TWEET, variables, features: COMMON_FEATURES }),
  })
}
```

### 2D. Like Tweet (POST)

**File:** `packages/utils/api/twitter.ts` (lines 495–504)

```ts
export async function likeTweet(tweetId: string) {
  return request(Endpoint.LIKE_TWEET, {
    body: JSON.stringify({
      variables: { tweet_id: tweetId },
      queryId: EndpointQuery.LIKE_TWEET,
    }),
  })
}
```

### 2E. Repost Tweet (POST)

**File:** `packages/utils/api/twitter.ts` (lines 506–516)

```ts
export async function repostTweet(tweetId: string) {
  return request(Endpoint.CREATE_RETWEET, {
    body: JSON.stringify({
      variables: { tweet_id: tweetId, dark_request: false },
      queryId: EndpointQuery.CREATE_RETWEET,
    }),
  })
}
```

### 2F. Delete Tweet (POST)

**File:** `packages/utils/api/twitter.ts` (lines 183–193)

---

## 3. Bookmark Sync Engine

### 3A. Full Sync vs Incremental Sync

**File:** `x-bookmarks/src/options/handlers.ts` (lines 91–168) — `initSync()`

The sync strategy depends on whether the user has ever synced before:

```ts
const lastForceSynced = await getLastSyncInfo()

if (!lastForceSynced) {
  // FULL SYNC — fetch ALL bookmarks from X, page by page
  setStore('isForceSyncing', true)
  for await (const docs of syncAllBookmarks(true)) { ... }
  await setLocal({ [StorageKeys.Last_Sync]: Math.floor(Date.now() / 1000) })
} else {
  // INCREMENTAL SYNC — fetch until we find already-synced bookmarks
  setStore('isAutoSyncing', true)
  for await (const docs of syncAllBookmarks()) { ... }
}
```

### 3B. The Sync Generator

**File:** `x-bookmarks/src/options/handlers.ts` (lines 221–273) — `syncAllBookmarks()`

Uses an `async function*` generator to yield batches as they arrive:

```ts
export async function* syncAllBookmarks(forceSync = false) {
  // Process any pending bookmark/unbookmark changes first
  const del_ids = await syncBookmarkChanges(true)

  // For full sync, resume from saved cursor (in case of interruption)
  let cursor = forceSync
    ? (await getLocal(StorageKeys.Bookmark_Cursor))[StorageKeys.Bookmark_Cursor]
    : undefined

  while (true) {
    const json = await getBookmarks(cursor)
    const instruction = json.data.bookmark_timeline_v2.timeline.instructions
      ?.find(i => i.type === 'TimelineAddEntries')

    let tweets = instruction.entries
      .filter(e => e.content.entryType === 'TimelineTimelineItem')

    if (!tweets.length) break

    // For incremental sync, stop when we find already-synced bookmarks
    if (!forceSync) {
      if (await isBookmarksSynced(tweets)) break
    }

    const docs = tweets
      .map(i => toRecord(i.content.itemContent, i.sortIndex))
      .filter(t => t && !del_ids.includes(t.tweet_id))

    await upsertRecords(docs)
    yield docs

    // Extract cursor for next page
    const target = instruction.entries[instruction.entries.length - 1].content
    if (target.entryType === 'TimelineTimelineCursor') {
      cursor = target.value
      if (forceSync) {
        await setLocal({ [StorageKeys.Bookmark_Cursor]: cursor })  // Persist for resume
      }
    } else {
      break
    }
  }
}
```

### 3C. Incremental Sync Detection

**File:** `x-bookmarks/src/options/handlers.ts` (lines 320–345) — `isBookmarksSynced()`

Checks if both the **first** and **last** tweet in the current page already exist locally with the same `sort_index`:

```ts
export async function isBookmarksSynced(tweets) {
  const [localLatest, localLast] = await Promise.all([
    getRecord(getTweetId(remoteLatest)),
    getRecord(getTweetId(remoteLast)),
  ])
  // If both endpoints exist locally with matching sort_index, this page is fully synced
  if (localLatest && localLast) {
    if (localLatest.sort_index === remoteLatest.sortIndex &&
        localLast.sort_index === remoteLast.sortIndex) {
      return true
    }
  }
  return false
}
```

**Edge case:** If a user unbookmarks then re-bookmarks a tweet, the `sort_index` changes. This comparison catches that — re-bookmarked tweets get re-synced.

### 3D. Cursor Persistence (Resumable Full Sync)

During full sync, the cursor is saved to `chrome.storage.local` after each page:
```ts
await setLocal({ [StorageKeys.Bookmark_Cursor]: cursor })
```

On next startup, full sync resumes from the saved cursor instead of starting over. This is critical for users with thousands of bookmarks where sync might be interrupted.

### 3E. Bookmark Change Processing

**File:** `x-bookmarks/src/options/handlers.ts` (lines 190–219) — `syncBookmarkChanges()`

Processes pending bookmark/unbookmark actions detected by the content script's XHR monkey-patch:

```ts
export async function syncBookmarkChanges(isInit = false) {
  const tasks = (await getLocal(StorageKeys.Tasks))[StorageKeys.Tasks] || []
  const del_ids = []

  for (const task of tasks) {
    const id = task.payload.variables.tweet_id
    if (task.type === TaskType.DeleteBookmark) {
      await deleteRecord(id)      // Remove from IndexedDB
      del_ids.push(id)
    }
  }

  // Update UI state
  mutateStore(state => {
    state.tweets = state.tweets.filter(t => !del_ids.includes(t.tweet_id))
  })

  // Clear processed tasks
  await setLocal({ [StorageKeys.Tasks]: [] })
  return del_ids
}
```

---

## 4. Tweet Parsing & Normalization

### 4A. Unwrapping Tweet Types

**File:** `packages/utils/api/twitter.ts` (lines 38–47) — `getTweet()`

X wraps some tweets in a visibility wrapper:

```ts
export function getTweet(tweet?: TweetUnion): TweetBase | null {
  if (!tweet) return null
  if (tweet.__typename === 'TweetWithVisibilityResults') {
    return tweet.tweet   // Unwrap the visibility wrapper
  }
  return 'legacy' in tweet && tweet.legacy ? tweet : null
}
```

**Tweet union types** (from `packages/utils/types/tweet.ts`):
- `TweetBase` — Standard tweet
- `TweetWithVisibilityResults` — Tweet with limited actions (e.g., from restricted accounts)
- `TweetTombstone` — Deleted tweet / protected account / suspended account
- `TweetUnavailable` — Unavailable (possibly NSFW)

### 4B. Extracting Tweet Fields

**File:** `packages/utils/api/twitter.ts` (lines 49–101) — `getTweetFields()`

```ts
function getTweetFields(tweet?: TweetUnion) {
  tweet = getTweet(tweet)
  if (!tweet) return null

  const user_legacy = tweet.core.user_results.result.legacy
  const entities = tweet.legacy.extended_entities || tweet.legacy.entities
  const media_items = entities?.media

  // Text extraction with t.co URL replacement
  let full_text = ''
  if (tweet.note_tweet) {
    full_text = tweet.note_tweet.note_tweet_results.result.text
    full_text = replaceWithExpandedUrl(full_text,
      tweet.note_tweet.note_tweet_results.result.entity_set.urls)
  } else {
    full_text = tweet.legacy.full_text
    full_text = replaceWithExpandedUrl(full_text, tweet.legacy.entities.urls)
  }

  return {
    username: user_legacy.name,
    screen_name: user_legacy.screen_name,
    avatar_url: user_legacy.profile_image_url_https,
    user_id: tweet.legacy.user_id_str,
    tweet_id: tweet.legacy.id_str,
    possibly_sensitive: tweet.legacy.possibly_sensitive,
    full_text,
    media_items,
    created_at: Math.floor(new Date(tweet.legacy.created_at).getTime() / 1000),
    lang: tweet.legacy.lang,
    views_count: tweet.views.count || 0,
    bookmark_count: tweet.legacy.bookmark_count,
    favorite_count: tweet.legacy.favorite_count,
    quote_count: tweet.legacy.quote_count,
    reply_count: tweet.legacy.reply_count,
    retweet_count: tweet.legacy.retweet_count,
    bookmarked: tweet.legacy.bookmarked,
    favorited: tweet.legacy.favorited,
    is_reply: !!tweet.legacy.in_reply_to_status_id_str,
    is_quote_status: tweet.legacy.is_quote_status,
    retweeted: tweet.legacy.retweeted,
    reply_tweet_url: is_reply
      ? `${Host}/${tweet.legacy.in_reply_to_screen_name}/status/${tweet.legacy.in_reply_to_status_id_str}`
      : '',
  }
}
```

### 4C. Building the Full Record

**File:** `packages/utils/api/twitter.ts` (lines 103–132) — `toRecord()`

Adds computed fields:

```ts
export function toRecord(record: TimelineTweet, sortIndex: string): Tweet | null {
  let tweet_base = getTweet(record.tweet_results?.result)
  const fields = getTweetFields(tweet_base)
  const has_quote = !!tweet_base.quoted_status_result?.result

  return {
    ...fields,
    sort_index: sortIndex,
    has_gif: !!media_items?.some(item => item.type === 'animated_gif'),
    has_image: !!media_items?.some(item => item.type === 'photo'),
    has_video: !!media_items?.some(item => item.type === 'video'),
    has_quote,
    is_long_text: !!tweet_base.note_tweet?.note_tweet_results,
    has_link: URL_REG.test(fields.full_text),
    is_thread: null,          // null = not checked yet (lazy-loaded)
    conversations: [],
    quoted_tweet: has_quote
      ? getTweetFields(tweet_base.quoted_status_result.result)
      : null,
  }
}
```

---

## 5. Bookmark Folders

### 5A. X Premium Folders (API-Based)

**File:** `packages/utils/api/twitter.ts` (lines 320–340)

X Premium users have server-side bookmark folders:

```ts
export function getFolders() {
  return request(`${Endpoint.GET_FOLDERS}?variables=%7B%7D`, {
    body: null, method: 'GET',
  })
}

export function getFolderTweets(folderId: string, cursor?: string) {
  const query = flatten({
    variables: {
      bookmark_collection_id: folderId,
      cursor: cursor || '',
      includePromotedContent: true,
    },
    features: COMMON_FEATURES,
  })
  return request(`${Endpoint.GET_FOLDER_TWEETS}?${query}`, {
    body: null, method: 'GET',
  })
}
```

**Endpoints:**
- `GET .../BookmarkFoldersSlice` — List all folders
- `GET .../BookmarkFolderTimeline` — Get tweets in a folder

### 5B. Local Folder Management

**File:** `x-bookmarks/src/stores/folders.ts`

Folders are managed locally in IndexedDB as a config option:

- **`initFolders()`** (lines 41–81) — Fetches X's server-side folders, merges with local folders, deduplicates
- **`addFolder(name)`** (lines 202–215) — Adds a new local folder
- **`removeFolder(name)`** (lines 129–148) — Removes folder, clears all tweet folder assignments
- **`moveTweetToFolder(folder, tweet)`** (lines 150–170) — Assigns tweet to folder, updates counts
- **`moveTweetsToFolder(folder)`** (lines 175–200) — Bulk-moves all unsorted tweets to a folder

### 5C. Folder Sync

**File:** `x-bookmarks/src/stores/folders.ts` (lines 83–127) — `syncXFolders()`

For each X Premium folder, fetches all tweets page-by-page and updates the `folder` field in IndexedDB:

```ts
export const syncXFolders = async (folders) => {
  for (const folder of folders) {
    let cursor = ''
    while (true) {
      const json = await getFolderTweets(folder.id, cursor)
      // Extract tweet IDs, update folder assignment in IndexedDB
      const ids = tweetsEntry.map(e => getPostId(user_id, tweet.rest_id))
      await updateFolder(ids, folder.name)
      cursor = cursorEntry.content.value
    }
  }
}
```

### 5D. Folder Storage Model

Each tweet has a `folder?: string` field — a tweet belongs to at most one folder. An empty/null folder means "Unsorted".

---

## 6. Search & Filtering

### 6A. Query Parser

**File:** `packages/utils/query-parser.ts`

Supports Twitter-style search operators:

```ts
export function parseTwitterQuery(query) {
  const patterns = {
    fromUser: /from:(\w+)/g,
    since: /since:(\d{4}-\d{2}-\d{2})/g,
    until: /until:(\d{4}-\d{2}-\d{2})/g,
  }
  // ... extracts operators and remaining keyword
}
```

**Supported operators:**
| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:elonmusk` | Filter by tweet author |
| `since:` | `since:2024-01-01` | Filter by date range (start) |
| `until:` | `until:2024-12-31` | Filter by date range (end) |
| (free text) | `react hooks` | Keyword search on `full_text` |

### 6B. Search Execution

**File:** `packages/utils/db/tweets.ts` (lines 138–200) — `findRecords()`

- Uses IndexedDB cursor iteration (no SQL-like queries).
- Selects index based on whether date filters exist: `created_at` for date ranges, `sort_index` for default ordering.
- Iterates in reverse (`'prev'`) to show newest first.
- Applies `meetsCriteria()` filter on each record:

```ts
function meetsCriteria(tweet, options, category, folder, user_id) {
  return (
    tweet.owner_id === user_id &&
    (!options.keyword || tweet.full_text.toLowerCase().includes(options.keyword.toLowerCase())) &&
    (!options.fromUser || tweet.screen_name.toLowerCase() === options.fromUser.toLowerCase()) &&
    (!category || tweet[category]) &&    // e.g., tweet.has_image for "image" category
    folderFilter                          // folder matching or "Unsorted"
  )
}
```

### 6C. Category Filters

Categories map directly to boolean fields on the Tweet object:
- `has_image` — Photos
- `has_video` — Videos
- `has_gif` — Animated GIFs
- `has_link` — URLs
- `has_quote` — Quote tweets
- `is_long_text` — Long-form (note_tweet)

### 6D. Omnibox Search

**File:** `x-bookmarks/src/background/index.ts` (lines 42–53)

Users can search bookmarks from Chrome's address bar with `tt` keyword:

```ts
chrome.omnibox.onInputEntered.addListener(async (text) => {
  const newURL = chrome.runtime.getURL('pages/options.html') + '#/?q=' + encodeURIComponent(text)
  // Opens or focuses the options page with search query
})
```

---

## 7. Thread Detection

### 7A. Lazy Thread Loading

**File:** `x-bookmarks/src/options/handlers.ts` (lines 279–318) — `syncThreads()`

Thread detection is deferred — not done during initial sync. The `is_thread` field starts as `null`:

```ts
export async function syncThreads() {
  const detailLimit = 50
  // Find tweets where is_thread hasn't been checked yet
  const records = await iterate(t => typeof t.is_thread !== 'boolean', detailLimit * 0.5)

  for (const record of records) {
    // Check rate limits before each request
    const rateLimitInfo = await getRateLimitInfo(Endpoint.TWEET_DETAIL, uid)
    if (rateLimitInfo?.remaining < 50) {
      const retryIn = rateLimitInfo.reset * 1000 - Date.now() + 60 * 1000
      setTimeout(syncThreads, retryIn)
      break
    }

    const conversations = await getTweetConversations(record.tweet_id)
    record.conversations = conversations
    record.is_thread = conversations.length > 0
    await upsertRecords([record], true)
  }

  // Schedule next batch in 10 minutes
  setTimeout(syncThreads, 10 * 60 * 1000)
}
```

### 7B. Conversation Extraction

**File:** `packages/utils/api/twitter.ts` (lines 277–318) — `getTweetConversations()`

Uses the TweetDetail endpoint to fetch the conversation thread:

```ts
export async function getTweetConversations(tweetId: string) {
  const json = await getTweetDetails(tweetId)
  const instructions = json.data.threaded_conversation_with_injections_v2.instructions
  const addEntries = instructions.find(i => i.type === 'TimelineAddEntries')

  // Find the original tweet's position
  let index = addEntries.entries.findIndex(i => i.entryId.includes(tweetId))
  if (index > 0) return []  // Original tweet should be at index 0

  // The first module entry after the original tweet contains self-thread replies
  let entry = addEntries.entries[1]
  const items = entry.content.items?.filter(i =>
    i.item.itemContent.itemType === 'TimelineTweet' &&
    i.item.itemContent.tweetDisplayType === 'SelfThread'  // Only self-thread, not other replies
  )

  const conversations = items.map(i => toRecord(i.item.itemContent, ''))
  return conversations
}
```

### 7C. TweetDetail API

**File:** `packages/utils/api/twitter.ts` (lines 236–270)

```ts
export function getTweetDetails(tweetId: string, cursor?: string) {
  const variables = {
    focalTweetId: tweetId,
    with_rux_injections: false,
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true,
    cursor: '',
  }
  // ... GET request to Endpoint.TWEET_DETAIL
}
```

**Endpoint:** `GET .../TweetDetail`
**Rate limit:** 150 requests per 15 minutes — the thread syncer respects this (checks `rateLimitInfo.remaining < 50`).

---

## 8. Media Handling

### 8A. Media Extraction

**File:** `packages/utils/api/twitter.ts` (line 59)

```ts
const entities = tweet.legacy.extended_entities || tweet.legacy.entities
const media_items = entities?.media
```

**Critical:** `extended_entities.media` takes priority over `entities.media`. Multi-image tweets and videos only have complete data in `extended_entities`.

### 8B. Media Type

**File:** `packages/utils/types/tweet.ts` (lines 172–214)

```ts
export interface Media {
  type: 'video' | 'photo' | 'animated_gif'
  media_url_https: string        // Image URL (for photos) or thumbnail (for videos)
  display_url: string
  expanded_url: string
  url: string                    // The t.co URL in the tweet text
  sizes: {
    large: { h: number; w: number; resize: string }
    medium: { h: number; w: number; resize: string }
    small: { h: number; w: number; resize: string }
    thumb: { h: number; w: number; resize: string }
  }
  video_info?: {
    aspect_ratio: number[]
    duration_millis: number
    variants: Variant[]          // Multiple quality options
  }
  ext_alt_text?: string          // Accessibility text
}
```

### 8C. Video URL Extraction

**File:** `packages/utils/api/twitter.ts` (lines 361–372) — `getTweetVideoUrl()`

Videos have multiple variants — the highest quality is the last one:

```ts
export async function getTweetVideoUrl(tweetId: string) {
  const json = await getTweetDetails(tweetId)
  const item = tweet.media_items.find(item => item.type === 'video')
  return item?.video_info.variants[item.video_info.variants.length - 1].url
}
```

### 8D. Media Download

**File:** `x-bookmarks/src/options/Export.tsx` (lines 121–209)

Uses `chrome.downloads.download()` to save media files with cancellation support.

---

## 9. URL & Link Handling

### 9A. t.co URL Replacement at Parse Time

**File:** `packages/utils/api/twitter.ts` (lines 26–36) — `replaceWithExpandedUrl()`

```ts
function replaceWithExpandedUrl(text: string, urls: EntityURL[]) {
  if (urls.length === 0) return text
  for (let item of urls) {
    text = text.replace(new RegExp(item.url, 'g'), item.expanded_url)
  }
  return text
}
```

**This is the critical function.** It replaces all `t.co` URLs in the tweet text with their expanded versions at **parse time**, before the data is stored. This means stored `full_text` already contains readable URLs.

Two different URL sources depending on tweet type:
- **Normal tweets:** `tweet.legacy.entities.urls`
- **Long-form tweets (note_tweet):** `tweet.note_tweet.note_tweet_results.result.entity_set.urls`

### 9B. EntityURL Structure

**File:** `packages/utils/types/index.ts` (lines 150–155)

```ts
export interface EntityURL {
  display_url: string     // "example.com/article"
  expanded_url: string    // "https://example.com/article/full-path"
  url: string             // "https://t.co/abc123"
  indices: number[]       // [start, end] position in text
}
```

### 9C. URL Detection Regex

**File:** `packages/utils/text.ts` (line 4)

```ts
export const URL_REG = /(?<!")(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6}\b([-a-zA-Z0-9@:.%_\+~#?&//=]*))(?!")/g
```

Used to determine `has_link` boolean on each tweet. Uses negative lookbehind/lookahead for double-quotes to avoid matching URLs inside HTML attributes.

### 9D. Text Linkification (Display)

**File:** `packages/utils/text.ts` (lines 36–44) — `linkify()`

```ts
export function linkify(text: string) {
  const attrs = 'target="_blank" class="text-blue-500 mx-1"'
  return text
    .replace(URL_REG, url => `<a href="${url}" ${attrs}>${url.replace(/[@#]/g, '')}</a>`)
    .replace(mentionRegex, `<a href="${Host}/$1" ${attrs}>@$1</a>`)
    .replace(hashtagRegex, `<a href="${Host}/hashtag/$1" ${attrs}>#$1</a>`)
}
```

Also supports keyword highlighting with `highlightAndLinkify()`, which shows excerpt around the match for long texts.

---

## 10. Long-Form Tweets (note_tweet)

### 10A. Detection

**File:** `packages/utils/types/tweet.ts` (lines 95–100)

```ts
note_tweet?: {
  is_expandable: boolean
  note_tweet_results: {
    result: NoteTweet
  }
}
```

### 10B. NoteTweet Structure

```ts
export interface NoteTweet {
  id: string
  text: string                    // The full long-form text (not truncated)
  entity_set: TweetEntities       // Has its own URL entities (different from legacy.entities)
  richtext: {
    richtext_tags: RichTextTag[]  // Bold/italic formatting
  }
  media: {
    inline_media: unknown[]       // Inline media in long-form tweets
  }
}
```

### 10C. Rich Text Tags

```ts
export interface RichTextTag {
  from_index: number
  to_index: number
  richtext_types: ('Bold' | 'Italic')[]
}
```

### 10D. Text Priority

In `getTweetFields()`:
1. If `note_tweet` exists → use `note_tweet.note_tweet_results.result.text`
2. Otherwise → use `tweet.legacy.full_text`

The `is_long_text` flag is set based on presence of `note_tweet`: `!!tweet_base.note_tweet?.note_tweet_results`

---

## 11. Quote Tweets

### 11A. Detection & Extraction

**File:** `packages/utils/api/twitter.ts` (line 115, 128–131)

```ts
const has_quote = !!tweet_base.quoted_status_result?.result

quoted_tweet: has_quote
  ? getTweetFields(tweet_base.quoted_status_result.result)
  : null,
```

Quote tweets are extracted recursively using the same `getTweetFields()` function. The `TweetBase` type has:

```ts
quoted_status_result?: {
  result: TweetUnion      // Can be any tweet type, including TweetWithVisibilityResults
}
```

### 11B. AI Classification

In the AI auto-organizing feature, both the tweet text and quoted tweet text are combined:

```ts
const text = tweet.quoted_tweet
  ? tweet.full_text + '\n' + tweet.quoted_tweet.full_text
  : tweet.full_text
```

---

## 12. Real-Time Bookmark Detection

### 12A. XHR Monkey-Patching

**File:** `x-bookmarks/src/contentScript/inject.ts` (lines 1–31)

Injected into every X page to detect bookmark/unbookmark actions in real time:

```ts
const origSend = XMLHttpRequest.prototype.send
const origOpen = XMLHttpRequest.prototype.open

XMLHttpRequest.prototype.open = function(method: string, url: string) {
  this._method = method
  this._url = url
  origOpen.apply(this, arguments)
}

XMLHttpRequest.prototype.send = function(data) {
  if (this._method === 'POST') {
    if (this._url.endsWith('/DeleteBookmark')) {
      window.postMessage({
        type: TaskType.DeleteBookmark,        // 'DeleteBookmark'
        payload: JSON.parse(data as string),  // Contains { variables: { tweet_id: "..." } }
      })
    } else if (this._url.endsWith('/CreateBookmark')) {
      window.postMessage({
        type: TaskType.CreateBookmark,
        payload: JSON.parse(data as string),
      })
    }
  }
  origSend.apply(this, [data])
}
```

### 12B. Message Flow

1. User clicks bookmark/unbookmark on X → XHR fires
2. Monkey-patched `send()` intercepts → `window.postMessage()` with type + payload
3. Content script listens for these messages → stores them as tasks in `chrome.storage.local` under `StorageKeys.Tasks`
4. On next extension page load → `syncBookmarkChanges()` processes pending tasks

---

## 13. Export

### 13A. Supported Formats

**File:** `packages/utils/exporter.ts`

| Format | Function | Details |
|--------|----------|---------|
| JSON | `jsonExporter()` | Pretty-printed with 2-space indent |
| CSV | `csvExporter()` | With BOM for Excel compatibility, escaped quotes/newlines |
| HTML | `htmlExporter()` | Bootstrap-styled table with inline images and media links |

### 13B. Export Fields

Exports include: `full_text`, `url` (constructed as `https://x.com/{screen_name}/status/{tweet_id}`), `media`, thread data (conversations), metadata, and all metrics.

### 13C. Media Export

Separate media export supports:
- Filtering by type (photos, videos, all)
- CSV of media URLs
- Direct download using `chrome.downloads.download()`
- Cancellation support
- Custom save paths

---

## 14. AI Auto-Organizing

**File:** `x-bookmarks/src/options/handlers.ts` (lines 420–549) — `smartTagging()`

Premium feature that auto-categorizes bookmarks into user-defined folders using a server-side API:

```ts
const res = await fetch(API_HOST + '/classify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Request-Id': btoa(JSON.stringify({ reqCount, uid, timestamp: Date.now(), level, license })),
  },
  body: JSON.stringify({
    tweetText: text,       // Includes quoted tweet text if present
    folders: folders,      // User's folder names
  }),
})
const json = await res.json()
const folder = json.data.folder     // AI-assigned folder name
```

- Processes tweets in batches of 20 with 3-second delays between each
- Rate limited to 200/day (Basic) or 500/day (Pro)
- Respects `isTagging` state for cancellation
- Sets `folder` to empty string if AI can't match a folder (marking as "AI-processed but uncategorizable")

---

## 15. IndexedDB Schema

### 15A. Database Structure

**File:** `packages/utils/db/index.ts`

| Property | Value |
|----------|-------|
| **DB Name** | `twillot` |
| **DB Version** | `20` |
| **Tweet Store (v2)** | `posts` (keyPath: `id`) |
| **Config Store (v2)** | `settings` (keyPath: `id`) |
| **Legacy Tweet Store** | `tweets` (keyPath: `tweet_id`) |
| **Legacy Config Store** | `configs` (keyPath: `option_name`) |

### 15B. Indexed Fields

**File:** `packages/utils/db/index.ts` (lines 18–34)

```
full_text, sort_index, screen_name, created_at, owner_id,
has_image, has_video, has_link, has_quote, is_long_text, folder
```

Plus `tags` with `multiEntry: true` (for array-valued index — each tag is individually queryable).

All indexes are `{ unique: false, multiEntry: false }` except `tags`.

### 15C. Record Key Format

**File:** `packages/utils/db/tweets.ts` (lines 12–18)

```ts
export function getPostId(user_id: string, tweet_id: string) {
  return tweet_id.includes(user_id) ? tweet_id : user_id + '_' + tweet_id
}
```

Example: `123456789_1701253017100517398`

### 15D. Upsert Logic

**File:** `packages/utils/db/tweets.ts` (lines 21–92)

When a record already exists, only **metadata fields** are updated (not the full record):

```ts
const metadataFields = 'views_count,bookmark_count,favorite_count,quote_count,reply_count,retweet_count,bookmarked,favorited,is_quote_status,retweeted'.split(',')
```

Plus `folder` (if present) and `is_thread`/`conversations` (only if `is_thread` is explicitly a boolean).

### 15E. Data Migration

**File:** `packages/utils/db/index.ts` (lines 38–130) — `migrateData()`

Migrates from legacy `tweets`/`configs` stores to `posts`/`settings`, adding `owner_id` to support multi-user.

### 15F. Config Storage

**File:** `packages/utils/db/configs.ts`

Config items store settings like folder lists and automation rules:

```ts
export interface Config {
  id: string              // "{userId}_{optionName}"
  owner_id: string
  updated_at: number      // Unix timestamp
  option_name: OptionName // 'folder' | 'rule' | 'workflow' | 'comment_template' | 'signature_template'
  option_value: any
}
```

### 15G. Analytics Queries

**File:** `packages/utils/db/tweets.ts`

- **`countRecords()`** (lines 251–321) — Counts by category: total, unsorted, image, video, gif, link, quote, long_text
- **`aggregateUsers()`** (lines 323–362) — Groups bookmarks by author, counts per user
- **`getTopUsers(n)`** (lines 364–369) — Top N most-bookmarked authors
- **`getRencentTweets(days)`** (lines 371–418) — Bookmark activity heatmap (date → count)

---

## 16. Rate Limiting & Error Handling

### 16A. Rate Limit Tracking

**File:** `packages/utils/api/twitter-base.ts` (lines 5–11, 32–38, 63–78)

Every response's rate limit headers are parsed and stored per-endpoint per-user:

```ts
const limit = res.headers.get('X-Rate-Limit-Limit')
const remaining = res.headers.get('X-Rate-Limit-Remaining')
const reset = res.headers.get('X-Rate-Limit-Reset')

rateLimitInfo[uid] = {
  [endpoint]: { limit, remaining, reset }
}
```

### 16B. Error Types

**File:** `packages/utils/xfetch.ts` (lines 1–8)

```ts
export enum FetchError {
  TimeoutError = 'TimeoutError',       // Request took >15 seconds
  IdentityError = 'IdentityError',     // 403 or missing token → need re-auth
  DataError = 'DataError',             // API returned { errors: [...] }
  NetworkError = 'NetworkError',       // General network failure
  RateLimitError = 'RateLimitError',   // 429 Too Many Requests
}
```

### 16C. HTTP Status Handling

**File:** `packages/utils/api/twitter-base.ts` (lines 79–109)

| Status | Behavior |
|--------|----------|
| 204 | Return `undefined` (No Content) |
| 403 | Throw `IdentityError` — triggers re-auth |
| 429 | Throw `RateLimitError` — caller backs off |
| 200 with `errors` | Throw `DataError` with retry time estimate from rate limit headers |

### 16D. Request Timeout

**File:** `packages/utils/xfetch.ts` (lines 10–38)

Default timeout: **15 seconds**. Uses `AbortController` for clean cancellation.

### 16E. Error Recovery in Sync

**File:** `x-bookmarks/src/options/handlers.ts` (lines 155–167)

```ts
catch (err) {
  if (err.name == FetchError.IdentityError || err.message == AuthStatus.AUTH_FAILED) {
    setStore('isAuthFailed', true)    // Trigger re-auth UI
    await logout(await getCurrentUserId())
  } else {
    setStore('isForceSyncTimedout', true)  // Show retry UI
    setStore('isForceSyncing', false)
  }
}
```

---

## 17. Transaction ID Rotation

### 17A. The Problem

X tracks `X-Client-Transaction-Id` headers to detect bot-like behavior. Reusing the same ID across requests is detectable.

### 17B. The Solution

**File:** `packages/utils/storage.ts` (lines 141–152)

```ts
function incrementFirstNumber(str: string): string {
  const numbers = str.match(/[1-8]/g) || []
  if (numbers.length === 0) return str

  const randomIndex = Math.floor(Math.random() * numbers.length)
  const targetNumber = numbers[randomIndex]

  return str.replace(new RegExp(targetNumber), (match) => {
    const num = parseInt(match)
    return (num < 8 ? num + 1 : 0).toString()
  })
}
```

**How it works:**
1. Find all digits 1–8 in the transaction ID string
2. Randomly pick one digit
3. Increment it by 1 (wrapping 8 → 0)
4. Only the **first occurrence** of that digit is changed (due to `replace` without `g` flag)

This runs **every time** `getAuthInfo()` is called, so each API request gets a slightly different transaction ID. The changes are small enough to look like natural browser behavior.

---

## 18. Feature Flags

### 18A. COMMON_FEATURES

**File:** `packages/utils/api/twitter-features.ts` (lines 1–26)

Sent with most API requests. Key flags:

| Flag | Value | Purpose |
|------|-------|---------|
| `longform_notetweets_consumption_enabled` | `true` | Enable note_tweet for 280+ chars |
| `longform_notetweets_inline_media_enabled` | `true` | Inline media in long tweets |
| `longform_notetweets_rich_text_read_enabled` | `true` | Bold/italic in long tweets |
| `view_counts_everywhere_api_enabled` | `true` | Include view counts |
| `tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled` | `true` | Include visibility-restricted tweets |
| `responsive_web_graphql_timeline_navigation_enabled` | `true` | Timeline pagination |
| `verified_phone_label_enabled` | `false` | Don't require phone verification labels |

### 18B. BOOKMARK_FEATURES

```ts
export const BOOKMARK_FEATURES = {
  ...COMMON_FEATURES,
  graphql_timeline_v2_bookmark_timeline: true,   // Bookmarks-specific flag
}
```

### 18C. USER_FEATURES

Extends COMMON_FEATURES with profile-specific flags like `blue_business_profile_image_shape_enabled`, `highlights_tweets_tab_ui_enabled`, etc.

---

## 19. CORS & Origin Spoofing

### 19A. Declarative Net Request Rules

**File:** `x-bookmarks/src/rules.json`

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        { "header": "Origin", "operation": "set", "value": "https://x.com" }
      ]
    },
    "condition": {
      "urlFilter": "https://x.com/i/api/graphql/*",
      "resourceTypes": ["main_frame", "xmlhttprequest", "sub_frame", "script", "other"]
    }
  }
]
```

**Why needed:** Chrome extensions making `fetch()` calls don't send an `Origin` header matching X's domain. X's API rejects requests without a valid Origin. This rule sets `Origin: https://x.com` on all GraphQL requests.

### 19B. Credentials Include

**File:** `packages/utils/api/twitter-base.ts` (line 60)

```ts
credentials: 'include'
```

**The single most critical line.** This tells `fetch()` to include X's session cookies (notably `ct0` for CSRF validation and auth cookies) with the request. Without this, the API returns 401 even with valid Bearer tokens.

---

## 20. Architecture & Permissions

### 20A. Manifest V3 Permissions

**File:** `x-bookmarks/src/manifest.ts` (lines 64–72)

```json
{
  "permissions": [
    "storage",                            // chrome.storage.local for auth tokens
    "webRequest",                         // Intercept API request headers
    "tabs",                               // Open/close auth tabs
    "sidePanel",                          // Side panel UI
    "declarativeNetRequest",              // Spoof Origin header
    "declarativeNetRequestWithHostAccess", // Host-specific header rules
    "downloads"                           // Export/download media
  ],
  "host_permissions": ["https://*.x.com/*"]
}
```

### 20B. Content Scripts

```json
{
  "content_scripts": [{
    "matches": ["https://x.com/*"],
    "js": ["src/contentScript/index.ts"],
    "run_at": "document_start"
  }]
}
```

`document_start` ensures cookies are read before any other scripts run.

### 20C. Component Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                          Chrome Extension                             │
├──────────────────────┬───────────────────────┬────────────────────────┤
│  Content Script      │  Background SW        │  Options Page (UI)     │
│  (runs on x.com)     │  (service worker)     │  (extension page)      │
│                      │                       │                        │
│  ┌────────────────┐  │  ┌─────────────────┐  │  ┌──────────────────┐  │
│  │ Read twid      │  │  │ webRequest      │  │  │ SolidJS UI       │  │
│  │ cookie → get   │──┼─▶│ onSendHeaders   │  │  │                  │  │
│  │ user ID        │  │  │ → capture auth  │  │  │ Search bar       │  │
│  └────────────────┘  │  │   headers       │  │  │ Category filters │  │
│                      │  └─────────────────┘  │  │ Folder sidebar   │  │
│  ┌────────────────┐  │         │             │  │ Export page       │  │
│  │ inject.ts:     │  │         ▼             │  │ AI organize       │  │
│  │ Monkey-patch   │  │  chrome.storage       │  │                  │  │
│  │ XMLHttpRequest │  │  (auth tokens,        │  │ Reads/writes     │  │
│  │ → detect       │  │   pending tasks,      │  │ IndexedDB &      │  │
│  │ bookmark/      │  │   sync cursor)        │  │ chrome.storage   │  │
│  │ unbookmark     │  │                       │  └──────────────────┘  │
│  └────────────────┘  │  ┌─────────────────┐  │         │             │
│         │            │  │ declarativeNet   │  │         ▼             │
│         │            │  │ Request: Origin  │  │    IndexedDB          │
│         │            │  │ → https://x.com  │  │  ┌──────────────┐    │
│         │            │  └─────────────────┘  │  │ posts (v2)    │    │
│         ▼            │                       │  │ settings (v2) │    │
│  window.postMessage  │                       │  │ tweets (v1)   │    │
│  → tasks queue       │                       │  │ configs (v1)  │    │
│                      │                       │  └──────────────┘    │
└──────────────────────┴───────────────────────┴────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │    X GraphQL API      │
                  │                       │
                  │  /Bookmarks           │ GET  – List bookmarks
                  │  /DeleteBookmark      │ POST – Remove bookmark
                  │  /CreateBookmark      │ POST – Add bookmark
                  │  /BookmarkFoldersSlice│ GET  – List folders
                  │  /BookmarkFolderTimeline│ GET – Folder contents
                  │  /TweetDetail         │ GET  – Thread detection
                  │  /UserByRestId        │ GET  – User profile
                  │  /CreateTweet         │ POST – Post tweet
                  │  /FavoriteTweet       │ POST – Like tweet
                  │  /CreateRetweet       │ POST – Repost
                  └───────────────────────┘
                              │
                  ┌───────────────────────┐
                  │   Twillot API         │
                  │   api.twillot.com     │
                  │                       │
                  │  /classify            │ POST – AI folder assignment
                  └───────────────────────┘
```

### 20D. Key Technical Tricks Summary

| Trick | File | Purpose |
|-------|------|---------|
| Read `twid` cookie via `document.cookie` | `contentScript/index.ts` | Detect logged-in user ID without any API call |
| `webRequest.onSendHeaders` listener | `background/index.ts` | Passively capture auth tokens from X's own requests |
| `initiator !== Host` guard | `background/index.ts:13` | Prevent intercepting extension's own requests |
| `declarativeNetRequest` Origin spoofing | `rules.json` | Bypass CORS when making API calls from extension context |
| `credentials: 'include'` on fetch | `twitter-base.ts:60` | Send X cookies with extension-initiated requests |
| Monkey-patching `XMLHttpRequest` | `contentScript/inject.ts` | Detect real-time bookmark/unbookmark actions |
| `openNewTab(url, false)` | `hooks/useAuth.tsx` | Open background tab for auth (not focused/visible) |
| IndexedDB (not chrome.storage) | `db/index.ts` | Handle thousands of bookmarks (chrome.storage has size limits) |
| Cursor-based pagination with persistence | `handlers.ts` | Fetch ALL bookmarks + resume interrupted syncs |
| `incrementFirstNumber()` on transaction_id | `storage.ts:141` | Rotate IDs to avoid pattern detection |
| `replaceWithExpandedUrl()` at parse time | `api/twitter.ts:26` | Store readable URLs, not t.co short URLs |
| `async function*` generator for sync | `handlers.ts:221` | Stream batches to UI during multi-page sync |
| `extended_entities || entities` for media | `api/twitter.ts:59` | Multi-image tweets need extended_entities |
| `note_tweet` text with separate entity_set | `api/twitter.ts:62-67` | Long tweets have different URL entities |
| Metadata-only upsert | `db/tweets.ts:62` | Update counts without overwriting user data (folders, notes) |

---

## 21. API Endpoint Reference

**File:** `packages/utils/types/index.ts` (lines 294–342)

| Endpoint Name | Query ID | Method | Description |
|--------------|----------|--------|-------------|
| `LIST_BOOKMARKS` | `UyNF_BgJ5d5MbtuVukyl7A` | GET | List all bookmarks (paginated) |
| `CREATE_BOOKMARK` | `aoDbu3RHznuiSkQ9aNM67Q` | POST | Add tweet to bookmarks |
| `DELETE_BOOKMARK` | `Wlmlj2-xzyS1GN3a6cj-mQ` | POST | Remove tweet from bookmarks |
| `GET_FOLDERS` | `i78YDd0Tza-dV4SYs58kRg` | GET | List bookmark folders (Premium) |
| `GET_FOLDER_TWEETS` | `e1T8IKkMr-8iQk7tNOyD_g` | GET | Get tweets in a folder |
| `TWEET_DETAIL` | `bFUhQzgl9zjo-teD0pAQZw` | GET | Full tweet with thread |
| `CREATE_TWEET` | `31-6kYrWwW7ZqHmLu2mm9w` | POST | Post a new tweet |
| `CREATE_NOTE_TWEET` | `AeGhOs6NT4w5_bCW5jBQJw` | POST | Post a long-form tweet |
| `DELETE_TWEET` | `VaenaVgh5q5ih7kvyVjgtg` | POST | Delete a tweet |
| `CREATE_RETWEET` | `ojPdsZsimiJrUGLR1sjUtA` | POST | Retweet |
| `LIKE_TWEET` | `lI07N6Otwv1PhnEgXILM7A` | POST | Like a tweet |
| `USER_DETAIL` | `GazOglcBvgLigl3ywt6b3Q` | GET | Get user by numeric ID |
| `USER_BY_SCREEN_NAME` | `oUZZZ8Oddwxs8Cd3iW3UEA` | GET | Get user by @handle |
| `USER_TWEETS` | `gQlOy4mD5C8M8fYxqa0FJg` | GET | User's tweet timeline |
| `USER_LIKES` | `Ov0pT_9__tQmK-XIzOf7pQ` | GET | User's liked tweets |
| `UPLOAD_MEDIA` | N/A | POST | `https://upload.x.com/i/media/upload.json` |

**Base path:** `https://x.com/i/api/graphql/{queryId}/{endpointName}`

**Note:** Query IDs are hardcoded in this codebase. X can change them at any time. In production, the `webRequest` listener also captures the query ID from intercepted requests for dynamic updating.

---

## 22. Sample Data Structures

### 22A. Raw Bookmarks API Response

```json
{
  "data": {
    "bookmark_timeline_v2": {
      "timeline": {
        "instructions": [
          {
            "type": "TimelineAddEntries",
            "entries": [
              {
                "entryId": "tweet-1701253017100517398",
                "sortIndex": "7522119019754258409",
                "content": {
                  "entryType": "TimelineTimelineItem",
                  "__typename": "TimelineTimelineItem",
                  "itemContent": {
                    "itemType": "TimelineTweet",
                    "__typename": "TimelineTweet",
                    "tweet_results": {
                      "result": {
                        "__typename": "Tweet",
                        "rest_id": "1701253017100517398",
                        "core": {
                          "user_results": {
                            "result": {
                              "__typename": "User",
                              "rest_id": "1669047598974369792",
                              "is_blue_verified": true,
                              "legacy": {
                                "name": "John Developer",
                                "screen_name": "johndev",
                                "profile_image_url_https": "https://pbs.twimg.com/.../photo_normal.jpg"
                              }
                            }
                          }
                        },
                        "views": { "count": "45231", "state": "EnabledWithCount" },
                        "legacy": {
                          "id_str": "1701253017100517398",
                          "full_text": "Thread on real-time sync 🧵\n\nhttps://t.co/abc123",
                          "created_at": "Mon Sep 11 18:30:00 +0000 2023",
                          "user_id_str": "1669047598974369792",
                          "bookmark_count": 342,
                          "bookmarked": true,
                          "favorite_count": 1205,
                          "quote_count": 23,
                          "reply_count": 87,
                          "retweet_count": 156,
                          "lang": "en",
                          "is_quote_status": false,
                          "possibly_sensitive": false,
                          "entities": {
                            "urls": [{
                              "url": "https://t.co/abc123",
                              "expanded_url": "https://blog.example.com/real-time-sync",
                              "display_url": "blog.example.com/real-time-sync"
                            }]
                          },
                          "extended_entities": {
                            "media": [{
                              "media_url_https": "https://pbs.twimg.com/media/F5xyz.jpg",
                              "type": "photo",
                              "sizes": { "large": { "w": 1920, "h": 1080 } }
                            }]
                          }
                        },
                        "note_tweet": null
                      }
                    }
                  }
                }
              },
              {
                "entryId": "cursor-bottom-7522119019754258400",
                "sortIndex": "7522119019754258400",
                "content": {
                  "entryType": "TimelineTimelineCursor",
                  "value": "HBaWwLjIq4CJtwEAAA==",
                  "cursorType": "Bottom"
                }
              }
            ]
          }
        ]
      }
    }
  }
}
```

### 22B. Normalized Tweet (stored in IndexedDB)

```ts
{
  // Identity
  id: "1669047598974369792_1701253017100517398",  // {userId}_{tweetId}
  owner_id: "1669047598974369792",
  tweet_id: "1701253017100517398",
  user_id: "1669047598974369792",

  // Author
  username: "John Developer",
  screen_name: "johndev",
  avatar_url: "https://pbs.twimg.com/.../photo_normal.jpg",

  // Content (t.co URLs already replaced with expanded URLs)
  full_text: "Thread on real-time sync 🧵\n\nhttps://blog.example.com/real-time-sync",
  lang: "en",
  possibly_sensitive: false,

  // Timestamps
  created_at: 1694454600,            // Unix timestamp (seconds, not ms)
  sort_index: "7522119019754258409", // X's sort order

  // Metrics
  views_count: 45231,
  bookmark_count: 342,
  favorite_count: 1205,
  quote_count: 23,
  reply_count: 87,
  retweet_count: 156,

  // Status flags
  bookmarked: true,
  favorited: false,
  retweeted: false,

  // Content type flags
  has_image: true,
  has_video: false,
  has_gif: false,
  has_link: true,
  has_quote: false,
  is_long_text: false,

  // Thread info (lazy-loaded)
  is_thread: null,          // null = not checked, true/false after check
  conversations: [],

  // Reply info
  is_reply: false,
  is_quote_status: false,
  reply_tweet_url: "",

  // Media
  media_items: [{
    type: "photo",
    media_url_https: "https://pbs.twimg.com/media/F5xyz.jpg",
    sizes: { large: { w: 1920, h: 1080 } }
  }],

  // Quoted tweet (recursively extracted)
  quoted_tweet: null,

  // Organization (user-managed or AI-assigned)
  folder: "",               // Empty = unsorted
  tags: [],                 // AI-generated tags (multiEntry index)
  title: "",                // AI-generated title
  note: "",                 // User note
}
```

### 22C. User Data Structure

```ts
{
  __typename: 'User',
  id: 'VXNlcjoxNjY5MDQ3NTk4OTc0MzY5Nzky',  // Base64-encoded global ID
  rest_id: '1669047598974369792',              // Numeric user ID
  is_blue_verified: true,
  profile_image_shape: 'Circle',
  legacy: {
    name: 'John Developer',
    screen_name: 'johndev',
    profile_image_url_https: 'https://pbs.twimg.com/.../photo_normal.jpg',
    profile_banner_url: 'https://pbs.twimg.com/...',
    description: 'Building cool stuff',
    followers_count: 15420,
    friends_count: 892,
    statuses_count: 4521,
    favourites_count: 12340,
    location: 'San Francisco',
    created_at: 'Wed Jun 14 18:22:20 +0000 2023',
    verified: false,
  },
  professional: {
    professional_type: 'Creator',
    category: [{ id: 4, name: 'Technology', icon_name: 'tech' }]
  }
}
```

---

## Summary

The extension works by:

1. **Reading the `twid` cookie** → knows WHO is logged in
2. **Intercepting `Authorization` + `X-Csrf-Token` headers** from X's own API calls → gets auth credentials
3. **Making direct `fetch()` requests** to X's GraphQL API with stolen credentials + `credentials: 'include'` + spoofed Origin header
4. **Parsing and normalizing** tweet data (replacing t.co URLs, extracting media from `extended_entities`, handling `note_tweet` for long-form)
5. **Storing everything in IndexedDB** with multi-user scoping, metadata-only upserts, and folder assignment
6. **Supporting full sync** (cursor-persisted, resumable) and **incremental sync** (stops at already-synced bookmarks)
7. **Detecting real-time changes** via XHR monkey-patching on X pages
8. **Exporting** to JSON/CSV/HTML with media download support
9. **AI auto-organizing** via server-side classification API

No visible tab is needed for syncing — the extension's pages make direct `fetch()` calls to X's API. The only time a tab opens is during initial authentication (and it opens in the background).
