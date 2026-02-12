# Line-by-Line Explanation: Why Each Technique Works & Whether It's Still Viable

---

## PART 1: Detecting the Logged-In User (Content Script)

```ts
// src/contentScript/index.ts
// This file runs on every x.com page because of the manifest config:
//   "matches": ["https://x.com/*"], "run_at": "document_start"
```

### Line-by-line:

```ts
for (const item of document.cookie.split(';')) {
```

**Why this works:** `document.cookie` returns ALL cookies for the current domain as a single
semicolon-separated string like `"twid=u%3D123; ct0=abc123; lang=en"`. Splitting by `';'`
gives you each cookie individually. Content scripts run in the page's DOM context, so
`document.cookie` returns x.com's cookies — but ONLY the ones NOT marked `HttpOnly`.
The `twid` cookie is intentionally NOT HttpOnly because X's own JavaScript needs to read it.

**Still good?** YES. `document.cookie` is a fundamental web API. It will always work for
non-HttpOnly cookies. X has kept `twid` readable by JS for years because their own frontend
code depends on it.

---

```ts
  const [key, value] = item.split('=')
```

**Why this works:** Each cookie is in the format `key=value`. Destructuring the split gives
you both parts. Note: this is slightly fragile — if a cookie VALUE contains `=`, this would
break. But `twid` values don't contain `=`, so it works fine here.

**Still good?** MOSTLY. A more robust approach would be:

```ts
const eqIndex = item.indexOf('=')
const key = item.slice(0, eqIndex).trim()
const value = item.slice(eqIndex + 1)
```

This handles edge cases where cookie values contain `=` signs.

---

```ts
  if (key.includes('twid')) {
```

**Why this works:** The `twid` cookie is Twitter's "Twitter ID" cookie. It exists ONLY when
a user is logged in. X sets this cookie upon successful login. If you log out, X deletes it.
So its mere presence = "user is logged in". They use `.includes('twid')` instead of
`=== 'twid'` because cookie keys sometimes have leading whitespace from the split
(` twid` vs `twid`).

**Still good?** YES, but fragile for a different reason. X could rename this cookie at any
time. They've used `twid` for 10+ years though, so it's stable in practice. A slightly
better approach would be `key.trim() === 'twid'` to be more precise.

**Risk:** If X ever marks `twid` as `HttpOnly`, this entire approach breaks. However, X's
own React frontend reads this cookie, so they'd break their own app. Very unlikely.

---

```ts
    setCurrentUserId(value.replace('u%3D', ''))
```

**Why this works:** The `twid` cookie value is URL-encoded. The raw value looks like
`u%3D123456789`, which decodes to `u=123456789`. The `u=` prefix is just Twitter's
convention — the actual user ID is the number after it. `.replace('u%3D', '')` strips
the prefix to get just `123456789`.

**Still good?** YES. The encoding format hasn't changed. You could also use
`decodeURIComponent(value).replace('u=', '')` which is slightly more correct
(handles the encoding properly rather than matching the encoded form).

---

```ts
    break
```

**Why:** Once you find `twid`, stop looping. There's only one, and continuing wastes cycles.

---

```ts
// What setCurrentUserId does:
export function setCurrentUserId(user_id: string) {
  return chrome.storage.local.set({ [StorageKeys.Current_UID]: user_id })
}
```

**Why this works:** `chrome.storage.local` is the extension's persistent key-value store.
It persists across browser restarts, tab closes, service worker shutdowns — everything.
By saving the user ID here, ANY part of the extension (background script, popup, options
page, sidepanel) can read it later without needing access to x.com's cookies.

**Still good?** YES. `chrome.storage.local` is the standard and recommended way to persist
extension data in MV3. It has a 10MB default limit (or unlimited with `unlimitedStorage`
permission). For a single user ID string, this is perfect.

---

## PART 2: Intercepting Auth Tokens (Background Service Worker)

```ts
// src/background/index.ts
chrome.webRequest.onSendHeaders.addListener(
```

**Why this works:** `chrome.webRequest` is a Chrome extension API that lets you observe
(and in MV2, modify) network requests the browser makes. `onSendHeaders` fires AFTER
the browser has assembled the full request headers but BEFORE the request leaves.
This means you can read the exact headers X's web app is sending, including auth tokens.

**Still good?** YES, but with caveats. In MV3, `webRequest` is still available for
READING headers (`onSendHeaders`). What changed is that MODIFYING headers now requires
`declarativeNetRequest` instead of `webRequest.onBeforeSendHeaders` with `blocking`.
For reading/observing, `webRequest` works fine in MV3.

---

```ts
  async (details: chrome.webRequest.WebRequestHeadersDetails) => {
    const { url, initiator } = details
```

**Why `details` has these fields:** Chrome passes a details object to every webRequest
listener containing the full request context. `url` is where the request is going.
`initiator` is the ORIGIN that triggered the request (the page's origin).

---

```ts
    if (initiator !== Host) {  // Host = 'https://x.com'
      return
    }
```

**Why this works:** This is a security check. It ensures we only capture headers from
requests INITIATED by x.com itself, not from other websites or the extension itself.
Without this, if another extension or page made a request to x.com's API, we might
capture incorrect/invalid headers.

**Why it matters:** When the extension later makes its OWN fetch requests to x.com's
API, those requests have `initiator` set to the extension's origin
(`chrome-extension://...`), NOT `https://x.com`. So this filter prevents the extension
from re-intercepting its own requests in an infinite loop.

**Still good?** YES. This is proper security hygiene.

---

```ts
    if (!url.includes('/Bookmarks') && !url.includes('/BookmarkFoldersSlice')) {
      return
    }
```

**Why this works:** X makes MANY GraphQL API calls on every page load (timeline, trends,
notifications, etc.). We only care about the Bookmarks-related ones because:
1. We know these endpoints require auth (so headers WILL contain tokens)
2. They only fire when the user visits the bookmarks page, confirming the user
   actually uses bookmarks

**Why not capture from ANY X API call?** You could. But narrowing the filter reduces
noise and ensures we only store credentials when the user has demonstrated intent to
use bookmarks.

**Still good?** YES, but the GraphQL query IDs (like `UyNF_BgJ5d5MbtuVukyl7A`) in the
URL DO change when X deploys new code. The URL path includes `/Bookmarks` as a human-
readable suffix though, and that's what's being matched here — not the query ID.
So this is resilient to query ID changes.

---

```ts
    await syncAuthHeaders(details.requestHeaders)
```

**Why this works:** `details.requestHeaders` is an array of `{name, value}` objects
representing every HTTP header on the request. This includes the auth headers that
X's JavaScript added.

---

## PART 3: Extracting & Storing Auth Headers

```ts
export async function syncAuthHeaders(
  requestHeaders: chrome.webRequest.HttpHeader[],
) {
  let csrf = '', token = '', uuid = '', transaction_id = ''
```

**Why four separate values:** X's API requires ALL of these headers to authenticate
a request. Missing any one causes a 403 Forbidden response.

---

```ts
  for (const { name: k, value: o } of requestHeaders || []) {
```

**Why this works:** Destructuring each header object into `{name, value}`. The `|| []`
is a safety fallback in case `requestHeaders` is somehow null/undefined (shouldn't
happen, but defensive coding).

---

```ts
    if (csrf && token && uuid && transaction_id) {
      break
    }
```

**Why:** Early exit optimization. Once we've found all four headers, no point scanning
the remaining headers (a request might have 15-20 headers).

---

```ts
    const t = k.toLowerCase()
    if (t === 'x-csrf-token') {
      csrf = o || ''
```

**Why `.toLowerCase()`:** HTTP header names are case-insensitive by spec. Chrome
usually preserves the original casing from JavaScript, but comparing lowercase
ensures it works regardless of how X's code capitalizes their headers.

**What is `x-csrf-token`?** This is the Cross-Site Request Forgery token. Its value
matches X's `ct0` cookie. X's server checks that the `X-Csrf-Token` header matches
the `ct0` cookie on every API request. This prevents CSRF attacks — a malicious
website can't forge this because it can't read x.com's cookies.

**Why the extension CAN use it:** The extension reads the header value from X's own
request (not the cookie directly). And when the extension makes its own requests
with `credentials: 'include'`, the browser automatically sends the `ct0` cookie.
Since the header value matches the cookie, X's server is satisfied.

**Still good?** YES. CSRF tokens are a fundamental web security pattern. X would
break their own app if they stopped using them.

---

```ts
    } else if (t === 'authorization') {
      token = o || ''
```

**What is this?** The Bearer token. Value looks like
`"Bearer AAAAAAAAAAAAAAAAAAAAANRILgAEA..."`. This is X's PUBLIC app-level bearer
token — it's the SAME token for every user. It identifies the "Twitter Web App"
as the client. It is NOT a user-specific OAuth token.

**Wait, if it's public, why does X's API accept it?** Because the actual user
authentication comes from the SESSION COOKIES sent alongside the request
(`credentials: 'include'`). The Bearer token just says "I'm the official web app"
and the cookies say "I'm user 123456789". Both are needed.

**Still good?** YES. X has used this same Bearer token for years. It's embedded in
their public JavaScript bundle — anyone can find it by viewing page source. Some
extensions even hardcode it.

---

```ts
    } else if (t === 'x-client-uuid') {
      uuid = o || ''
```

**What is this?** A device/session identifier. X uses it for analytics and rate
limiting per device. It's optional — some browsers (Edge) include it, Chrome
sometimes doesn't. The extension stores it but it's not strictly required.

**Still good?** YES, though it's the least critical header.

---

```ts
    } else if (t === 'x-client-transaction-id') {
      transaction_id = o || ''
```

**What is this?** A per-request transaction identifier. X added this relatively
recently as an anti-automation measure. Each request is supposed to have a
unique-ish transaction ID. If X sees the EXACT same transaction ID reused many
times, it might flag the requests as automated.

**Still good?** This is the MOST fragile header. X has been tightening validation
on this. The extension mitigates this with `incrementFirstNumber()` (see below).

---

```ts
  if (!csrf || !token || !transaction_id) {
    console.log('syncAuthHeaders: missing headers', { csrf, token, uuid, transaction_id })
    return
  }
```

**Why:** Don't save incomplete credentials. If any required header is missing,
the stored auth would be useless and API calls would fail with 403.

---

```ts
  const uid = await getCurrentUserId()
  if (uid) {
    await setLocal({ csrf, token, uuid, transaction_id })
  }
```

**Why check `uid`?** The extension uses per-user storage keys (like
`user:123456789:token`). Without knowing which user these credentials belong to,
we can't store them properly. The content script must have already set the user
ID from the `twid` cookie before auth headers can be saved.

**Why per-user storage?** Supports multiple X accounts. If you're logged into
@alice in one Chrome profile and switch to @bob, each account's credentials are
stored separately under their user ID.

**Still good?** YES. This is a clean, scalable design.

---

## PART 4: The Transaction ID Rotation Trick

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

**Why this exists:** X validates the `X-Client-Transaction-Id` header. If you
reuse the exact same value for every request, X may flag your requests as automated
and rate-limit or block you.

**How it works:** Takes the captured transaction ID and randomly changes one digit
by incrementing it. This makes each request's transaction ID SLIGHTLY different from
the original — similar enough to look legitimate, different enough to not be identical.

**Why [1-8] and not [0-9]?** Avoiding 0 and 9 simplifies the increment logic:
incrementing 8 wraps to 0, and they skip 9 entirely. This is a pragmatic shortcut —
it doesn't need to be cryptographically random, just varied enough.

**Still good?** FRAGILE. X has been tightening transaction ID validation. The real
X web app generates these using a complex algorithm involving the page's DOM structure.
If X starts validating the structure/format more strictly, this simple rotation won't
pass. Some newer scrapers have had to reverse-engineer X's full transaction ID
generation algorithm. For a browser extension though, this light rotation has been
sufficient because the requests also carry legitimate cookies.

---

## PART 5: Making API Requests

```ts
function get_headers(headers: { token, csrf, uuid, transaction_id }) {
  return {
    Authorization: token,
```

**Why:** Identifies the request as coming from the "Twitter Web App" client. X's API
gateway checks this first.

---

```ts
    'X-Csrf-Token': csrf,
```

**Why:** Must match the `ct0` cookie. X's server compares them — if they don't match,
the request is rejected as a potential CSRF attack.

---

```ts
    'X-Client-Uuid': uuid,
```

**Why:** Device identifier for analytics/rate-limiting. Optional but helps the request
look more legitimate.

---

```ts
    'X-Client-Transaction-Id': transaction_id,
```

**Why:** Anti-automation measure. X expects each request to have a unique-ish ID.

---

```ts
    'Content-Type': 'application/json',
```

**Why:** Tells X's server the request body (if any) is JSON. For GET requests (like
fetching bookmarks), this is technically unnecessary since there's no body, but X's
API gateway may check for it anyway.

---

```ts
    'X-Twitter-Active-User': 'yes',
```

**Why:** Tells X this is from an active (not idle) user session. X may use this for
analytics or to differentiate background prefetch from active browsing.

---

```ts
    'X-Twitter-Auth-Type': 'OAuth2Session',
```

**Why:** Tells X's API that authentication is via an OAuth2 session (cookie-based),
NOT via an OAuth2 Bearer token from a developer app. This is important — X's API
behaves differently for session-authenticated requests vs. developer API requests.
Session auth has access to endpoints like Bookmarks that the public developer API
doesn't expose (or charges $100/mo for).

**Still good?** YES. This is how X's own web app authenticates.

---

```ts
    'X-Twitter-Client-Language': 'en',
```

**Why:** Tells X to return content in English. Affects things like error messages and
some localized content. Cosmetic, not functional.

---

### The actual fetch call:

```ts
const res = await fetchWithTimeout(url, {
  method: 'POST',
  credentials: 'include',
  ...options,
})
```

**Why `credentials: 'include'`:** THIS IS THE MOST CRITICAL LINE. It tells the browser
to include x.com's cookies in this request. Without it, the request would go out without
any cookies, and X would see an unauthenticated request.

**How this works technically:** When the extension's service worker makes a `fetch()` to
`https://x.com/...`, the browser checks: "Does this extension have `host_permissions` for
`https://*.x.com/*`?" If yes, AND `credentials: 'include'` is set, the browser attaches
x.com's cookies to the outgoing request. This is a Chrome extension privilege — a normal
website cannot do this due to same-origin policy.

**The cookies that get sent:**
- `auth_token` — The session token (HttpOnly, so JS can't read it, but the browser sends it)
- `ct0` — The CSRF token (must match `X-Csrf-Token` header)
- `twid` — The user ID
- Various other session cookies

**Still good?** YES. This is a core Chrome extension capability and the primary reason
extensions are more powerful than regular web pages. `credentials: 'include'` with
`host_permissions` is the officially supported way to make authenticated cross-origin
requests from extensions.

---

## PART 6: Origin Header Spoofing

```json
// src/rules.json
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

### Line by line:

```json
"id": 1, "priority": 1,
```

**Why:** `declarativeNetRequest` rules need unique IDs and priorities. With only one rule,
both are `1`.

---

```json
"action": { "type": "modifyHeaders",
  "requestHeaders": [
    { "header": "Origin", "operation": "set", "value": "https://x.com" }
  ]
}
```

**Why this is needed:** When the extension's service worker makes a `fetch()` to
`https://x.com/i/api/graphql/...`, the browser sets the `Origin` header to
`chrome-extension://abcdef123456` (the extension's own origin). X's server checks the
`Origin` header and rejects requests that don't come from `https://x.com`. This rule
OVERWRITES the Origin header to `https://x.com` before the request leaves the browser.

**Why X checks Origin:** It's a CORS (Cross-Origin Resource Sharing) security measure.
X's API is meant to only accept requests from x.com's own frontend, not from random
third-party websites. The Origin header tells the server where the request came from.

**Why Chrome allows this:** Extensions with `declarativeNetRequest` permission and
matching `host_permissions` are explicitly allowed to modify headers on requests to
those hosts. This is by design — extensions are user-installed trusted software.

**Still good?** YES. `declarativeNetRequest` is Chrome's officially recommended way
to modify headers in MV3. It replaced the old MV2 `webRequest.onBeforeSendHeaders`
blocking approach. This is the "correct" modern way to do it.

---

```json
"condition": {
  "urlFilter": "https://x.com/i/api/graphql/*",
```

**Why this specific URL pattern:** Only spoof Origin for GraphQL API calls, not for
ALL requests to x.com. If you spoofed Origin on regular page loads, it could cause
weird issues with X's frontend code. Narrow targeting = fewer side effects.

---

```json
  "resourceTypes": ["main_frame", "xmlhttprequest", "sub_frame", "script", "other"]
```

**Why all these types:** `xmlhttprequest` would be sufficient for `fetch()` calls, but
including other types provides a safety net. The extension's fetch calls from the
service worker are typed as `xmlhttprequest` (or sometimes `other` depending on Chrome's
internal classification).

**Still good?** YES but slightly over-broad. You could narrow it to just
`["xmlhttprequest"]` for cleaner targeting.

---

## PART 7: Fetching Bookmarks

```ts
export async function getBookmarks(cursor?: string) {
```

**Why `cursor` is optional:** First page has no cursor. Subsequent pages pass the cursor
from the previous response. This is standard cursor-based pagination.

---

```ts
  const variables = {
    cursor: '',
    count: 100,
    includePromotedContent: true,
  }
```

**Why `count: 100`:** This is the maximum page size X allows for the Bookmarks endpoint.
You could set it to 20 or 50 for smaller pages, but 100 minimizes the number of
requests needed to sync all bookmarks.

**Why `includePromotedContent: true`:** X's API requires this flag even though bookmarks
don't actually contain promoted content. If you set it to `false`, the API may return
an error or behave differently. Matching exactly what X's web app sends is safest.

**Still good?** YES, but the specific variable names and values can change when X updates
their GraphQL schema. When that happens, you need to inspect X's network requests again
to see what the new format is.

---

```ts
  const query = flatten({
    variables,
    features: BOOKMARK_FEATURES,
  })
```

**What is `features`?** X uses feature flags to control what data the API returns. These
are boolean toggles like `responsive_web_graphql_timeline_navigation_enabled: true`.
If you don't include the expected feature flags, the API may return different response
shapes or errors.

**Why flatten?** The GraphQL API takes these as URL query parameters (not POST body for
this GET request). `flatten()` converts the nested objects into URL-encoded key=value pairs:
`variables=%7B%22count%22%3A100%7D&features=%7B...%7D`

**Still good?** THE MOST FRAGILE PART. Feature flags change frequently when X deploys
new code. Every few weeks/months, X adds new feature flags or changes existing ones.
If the extension sends outdated feature flags, the API may reject the request or return
data in an unexpected format. Extensions must be updated to match. This is the #1
maintenance burden for any X-related extension.

---

## PART 8: The Authentication Flow (When No Credentials Exist)

```ts
const startAuth = async () => {
  await logout(await getCurrentUserId())
```

**Why logout first?** Clears any stale/expired credentials from storage. If old
credentials exist but are expired, the checkAuth polling would see a token exists
and think auth succeeded, but API calls would still fail.

---

```ts
  const authed = await checkAuth()
  if (authed) return
```

**Why check again?** Race condition prevention. Maybe credentials appeared between the
time the user clicked "authenticate" and this function ran. Skip the whole flow if
already authenticated.

---

```ts
  setIsAuthenicating(true)
  tab = await openNewTab(ActionPage.AUTHENTICATE, false)
```

**What is `ActionPage.AUTHENTICATE`?** It's `'https://x.com/i/bookmarks?twillot=reauth'`.
This opens the X bookmarks page.

**Why `false`?** The second parameter is `active`. Setting it to `false` opens the tab
in the background — the user's current tab stays focused. The comment in the code says:
_"Most users are already logged in to Twitter, so no need to focus this window"_

**Why this works for auth:** When x.com loads in the background tab, X's JavaScript makes
API calls to fetch bookmarks. Those API calls include all the auth headers. The background
service worker's `webRequest.onSendHeaders` listener captures those headers. The content
script on that page reads the `twid` cookie. Both pieces of data get saved to storage.

**Why `?twillot=reauth`?** This query param doesn't affect X's behavior — X ignores
unknown query params. It's there so the extension can identify tabs it opened (to close
them later).

**Still good?** YES. This is a clever, user-friendly approach. The user doesn't have
to manually copy tokens or do anything special. They just need to be logged in to X.

---

```ts
  timerId = setInterval(checkAuth, 3000)
```

**Why polling?** The background tab loading is asynchronous. The content script and
webRequest listener will save credentials at unpredictable times. Polling every 3
seconds checks if credentials have appeared in storage yet.

**Why 3 seconds?** Balance between responsiveness (user waits for auth) and resource
usage. 1 second would be more responsive but wasteful. 5 seconds would make the user
wait longer. 3 is a pragmatic middle ground.

**Still good?** YES, but you could also use `chrome.storage.onChanged` listener instead
of polling, which would be more efficient and respond instantly when credentials are saved.

---

```ts
const checkAuth = async () => {
  const user_id = await getCurrentUserId()
  if (!user_id) return false

  const auth = await getAuthInfo()
  const authenticated = !!(auth && auth.token)
  setIsAuthFailed(!authenticated)

  if (authenticated) {
    clearInterval(timerId)
    if (tab) chrome.tabs.remove(tab.id)
    location.reload()
  }
  return authenticated
}
```

**Why `chrome.tabs.remove(tab.id)`?** Once auth is captured, the background tab is no
longer needed. Closing it automatically is good UX — the user never has to deal with
a mystery tab.

**Why `location.reload()`?** The extension's options page reloads to switch from the
"Authenticate" UI to the "Bookmarks" UI. A simpler approach than managing reactive state
transitions.

---

## PART 9: XHR Monkey-Patching (Real-Time Bookmark Detection)

```ts
const origSend = XMLHttpRequest.prototype.send
const origOpen = XMLHttpRequest.prototype.open
```

**Why save originals?** We're about to overwrite these prototype methods. Saving
references to the originals lets us call the REAL `open()` and `send()` after our
interception logic runs. Without this, we'd break all XHR requests on x.com.

---

```ts
XMLHttpRequest.prototype.open = function (method: string, url: string) {
  this._method = method
  this._url = url
  origOpen.apply(this, arguments)
}
```

**Why patch `open`?** We need to know the request URL and method BEFORE `send()` fires.
`XMLHttpRequest.open()` is where the URL is set, but `send()` is where the request
actually fires. By saving `method` and `url` as custom properties on the XHR instance
(`this._method`, `this._url`), we can inspect them later in `send()`.

**Why `origOpen.apply(this, arguments)`?** Calls the REAL `open()` with the exact same
arguments and `this` context. The request proceeds normally — we just added metadata
to the XHR object.

---

```ts
XMLHttpRequest.prototype.send = function (data: string | FormData | null) {
  if (this._method === 'POST') {
    if (this._url.endsWith('/DeleteBookmark')) {
      window.postMessage({
        type: TaskType.DeleteBookmark,
        payload: JSON.parse(data as string),
      })
```

**Why intercept `send`?** This is when the request body is available. For bookmark
operations, the body contains the tweet ID being bookmarked/unbookmarked.

**Why `window.postMessage`?** Content scripts run in an "isolated world" — they share
the DOM with the page but have a separate JavaScript environment. HOWEVER, this file
(`inject.ts`) is INJECTED directly into the PAGE's JavaScript context (not the content
script's isolated world). So it needs `window.postMessage` to communicate with the
content script, which listens via `window.addEventListener('message', ...)`.

**Why check for `/DeleteBookmark` and `/CreateBookmark`?** These are the two GraphQL
mutations X fires when a user clicks the bookmark/unbookmark button. By intercepting
them, the extension knows IN REAL TIME when the user's bookmarks change, without needing
to re-fetch the entire bookmark list.

**Still good?** MOSTLY YES, but with a caveat. X's web app uses `fetch()` for most API
calls, not `XMLHttpRequest`. If X has fully migrated away from XHR, this patch would
miss those calls. You might also need to monkey-patch `window.fetch`:

```ts
const origFetch = window.fetch
window.fetch = function(url, options) {
  if (options?.method === 'POST' && url.includes('/DeleteBookmark')) {
    window.postMessage({ type: 'DeleteBookmark', payload: JSON.parse(options.body) })
  }
  return origFetch.apply(this, arguments)
}
```

In practice, X currently uses both XHR and fetch in different code paths, so patching
both is the safest approach.

---

```ts
  origSend.apply(this, [data])
```

**Why `[data]`?** Calls the original `send()` with the request body. The request
proceeds as normal — the user's bookmark action still works. We're just observing,
not blocking.

---

## PART 10: IndexedDB Storage

```ts
export async function upsertRecords(records: Tweet[], isUpdate = false) {
  const db = await openDb()
  const user_id = await getCurrentUserId()
```

**Why IndexedDB instead of `chrome.storage.local`?**

| Feature | chrome.storage.local | IndexedDB |
|---------|---------------------|-----------|
| Storage limit | 10MB (default) | Effectively unlimited |
| Query support | Key-value only | Indexes, cursors, ranges |
| Performance | Slow for large datasets | Fast with indexes |
| Data structure | JSON only | Structured with schemas |

A user with 5,000+ bookmarks (each ~2-3KB) needs 10-15MB of storage. IndexedDB handles
this easily. `chrome.storage.local` would hit limits and has no query/filtering support.

**Still good?** YES. IndexedDB is the correct choice for this use case. It's the standard
for large structured datasets in browser extensions.

---

```ts
const key = getPostId(user_id, record.tweet_id) // "{userId}_{tweetId}"
record.id = key
record.owner_id = user_id
```

**Why composite key?** If the extension supports multiple X accounts, the same tweet
could be bookmarked by both accounts. Using `userId_tweetId` as the key ensures each
account's bookmarks are separate.

---

```ts
const getRequest = objectStore.get(key)
getRequest.onsuccess = () => {
  const existingRecord = getRequest.result
  if (existingRecord) {
    // Update metadata only
    metadataFields.forEach(field => {
      if (field in record) existingRecord[field] = record[field]
    })
    objectStore.put(existingRecord)
  } else {
    objectStore.put(record)
  }
}
```

**Why check-then-update instead of just `put()`?** IDB's `put()` overwrites entirely.
If the user has added custom folders, tags, or notes to a bookmark, a blind `put()` would
erase those customizations. This upsert pattern:
1. If bookmark exists: update only metadata (like counts, bookmarked status)
2. If bookmark is new: insert the full record

**Still good?** YES. This is the standard upsert pattern for IndexedDB. One improvement
would be to use IDB transactions more efficiently by batching reads and writes.

---

## OVERALL VIABILITY ASSESSMENT (2026)

### What's SOLID and will continue working:

1. **`document.cookie` for `twid`** — X depends on this themselves. Stable.
2. **`chrome.webRequest.onSendHeaders`** for reading headers — Official MV3 API. Stable.
3. **`credentials: 'include'`** on fetch — Core extension privilege. Stable.
4. **`declarativeNetRequest`** for Origin spoofing — Official MV3 replacement for
   webRequestBlocking. Stable.
5. **IndexedDB** for storage — Web standard. Stable.
6. **`chrome.storage.local`** for settings — Extension standard. Stable.
7. **Cursor-based pagination** — Standard pattern. Stable.

### What's FRAGILE and requires ongoing maintenance:

1. **GraphQL query IDs** (like `UyNF_BgJ5d5MbtuVukyl7A`) — Change every X deployment.
   Must be updated regularly. **HIGHEST MAINTENANCE COST.**

2. **Feature flags** (`BOOKMARK_FEATURES`) — Change frequently. API rejects requests
   with outdated flags. **HIGH MAINTENANCE COST.**

3. **Transaction ID validation** — X is tightening this. Simple rotation may stop
   working. **MEDIUM RISK.**

4. **XHR monkey-patching** — X may move fully to fetch. Need to patch both.
   **MEDIUM RISK.**

5. **Response data structure** — X occasionally reorganizes their GraphQL response
   shapes. Type definitions need updating. **MEDIUM MAINTENANCE COST.**

### What could BREAK everything:

1. **X adds anti-bot challenge** (like Cloudflare Turnstile) to API requests.
   Extensions can't solve CAPTCHAs in the background.

2. **X switches to request signing** where each request needs a cryptographic
   signature derived from their JavaScript. Simple header replay wouldn't work.

3. **Chrome restricts `credentials: 'include'` for extensions** — Very unlikely,
   but would kill ALL similar extensions, not just this one.

4. **X moves bookmarks behind a paywall API** — Already partially done with their
   developer API ($100/mo). The GraphQL web API is free because it's what the web
   app uses.

### Recommendation for a new extension in 2026:

The approach is still viable and is used by many popular extensions. The main cost
is **ongoing maintenance** to update query IDs and feature flags when X deploys.
If you're building a new extension, consider:

1. **Auto-detecting query IDs** from X's JavaScript bundle instead of hardcoding them
2. **Auto-detecting feature flags** from X's network requests instead of hardcoding
3. **Patching both XHR and fetch** for comprehensive request interception
4. **Using `chrome.storage.onChanged`** instead of polling for auth state changes
5. **Adding a fallback** that prompts the user to visit x.com/bookmarks if passive
   header capture fails
