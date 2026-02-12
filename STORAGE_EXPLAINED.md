# How twitter-bookmarks-search Stores Bookmarks

Source: [github.com/twillot-app/twitter-bookmarks-search](https://github.com/twillot-app/twitter-bookmarks-search)

---

## The Surprising Answer: It Doesn't Persist Anything

This extension has **zero persistent storage**. No IndexedDB. No `chrome.storage`. No localStorage. Everything lives in **JavaScript memory variables** that die when the page reloads.

There are only **two in-memory variables** that matter in the entire extension:

```js
// content-script.js — top level module scope
let authorization    // Bearer token (string)
let csrfToken        // CSRF token (string)
```

And one React state that holds all bookmarks:

```js
// Inside useBookmarkedTweets() hook
const [tweets, setTweets] = React.useState(null)
```

That's it. The entire "database" is a React `useState`.

---

## Complete Data Flow

### Step 1: Background script captures credentials → sends via message

```
User visits twitter.com/i/bookmarks
        │
        ▼
Twitter's JS makes API call to fetch bookmarks page
        │
        ▼
background.js intercepts the request headers via webRequest.onSendHeaders
        │
        ├── Extracts: authorization header ("Bearer AAAA...")
        ├── Extracts: x-csrf-token header
        └── Stores in: module-level variables (in-memory only)
        │
        ▼
background.js sends credentials to content script via browser.tabs.sendMessage()
        │
        ▼
content-script.js receives message, stores in module-level variables
```

Here's exactly how:

```js
// background.js — captures from Twitter's own requests
browser.webRequest.onSendHeaders.addListener(
  async details => {
    tabId = details.tabId
    authorization = details.requestHeaders
      .find(h => h.name.toLowerCase() === "authorization").value
    csrfToken = details.requestHeaders
      .find(h => h.name.toLowerCase() === "x-csrf-token").value
    sendCredentials()  // forward to content script
  },
  { urls: ["*://*.twitter.com/*Bookmarks*"] },
  ["requestHeaders"]
)

// Sends credentials to the content script running on the twitter tab
async function sendCredentials() {
  let messageSent = false
  let tries = 0
  while (!messageSent && tries < 100) {
    try {
      tries++
      await browser.tabs.sendMessage(tabId, {
        name: "credentials",
        authorization,    // "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAEA..."
        csrfToken,        // "f8e2a1b3c4d5..."
      })
      messageSent = true
    } catch (err) {
      await delay(50)     // content script may not be ready yet, retry
    }
  }
}
```

```js
// content-script.js — receives and stores in memory
let authorization
let csrfToken

async function messageListener(message) {
  if (message.name === "credentials") {
    authorization = message.authorization
    csrfToken = message.csrfToken
  }
}
browser.runtime.onMessage.addListener(messageListener)
```

### Step 2: Content script fetches ALL bookmarks in one API call

```js
async function fetchBookmarks() {
  if (!authorization) return console.log("authorization is blank")
  if (!csrfToken) return console.log("csrfToken is blank")

  const res = await fetch(
    "https://api.twitter.com/2/timeline/bookmark.json?...&count=10000&...",
    //                                                      ^^^^^^^^^^^
    //                                                  Requests up to 10,000 at once
    {
      credentials: "include",
      headers: {
        accept: "*/*",
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-csrf-token": csrfToken,
        authorization,
      },
      referrer: window.location.href,
      method: "GET",
    }
  )
  const json = await res.json()
  return json
}
```

**Important:** This uses the OLD **v1-style REST API** (`api.twitter.com/2/timeline/bookmark.json`), not the newer GraphQL API. The response format is completely different from the newer Twillot extension.

### Step 3: Response is processed and held in React state

```js
function useBookmarkedTweets() {
  const [tweets, setTweets] = React.useState(null)

  React.useEffect(() => {
    ;(async () => {
      // Wait until credentials arrive from background script
      while (!authorization && !csrfToken) {
        await delay(10)
      }

      let success = false
      let tries = 0
      while (!success && tries < 2) {
        try {
          tries++
          const json = await fetchBookmarks()

          // THE KEY TRANSFORMATION:
          // API returns tweets and users as separate dictionaries
          let tweets = Object.values(json.globalObjects.tweets)
          let users = json.globalObjects.users

          // Merge each tweet with its author's user object
          tweets = tweets.map(tweet => ({
            ...tweet,
            user: users[tweet.user_id_str]
          }))

          setTweets(tweets)   // ← THIS IS THE ENTIRE "DATABASE"
          success = true
        } catch (err) {
          await delay(500)
        }
      }
    })()
  }, [])

  return tweets  // array of tweet objects, or null if still loading
}
```

---

## The API Response Format (v1 REST API)

This extension uses the **old** REST endpoint which returns a very different shape from GraphQL:

```json
{
  "globalObjects": {
    "tweets": {
      "1701253017100517398": {
        "id_str": "1701253017100517398",
        "full_text": "Cold Email 101\n\nOver the past month...",
        "user_id_str": "1669047598974369792",
        "created_at": "Mon Sep 11 15:15:01 +0000 2023",
        "favorite_count": 47,
        "retweet_count": 12,
        "reply_count": 5,
        "quote_count": 0,
        "lang": "en",
        "is_quote_status": false,
        "possibly_sensitive": false,
        "entities": {
          "urls": [],
          "user_mentions": [],
          "hashtags": [],
          "media": [
            {
              "media_url_https": "https://pbs.twimg.com/media/F5xyz.jpg",
              "type": "photo",
              "sizes": {
                "large": { "w": 1920, "h": 1080, "resize": "fit" }
              }
            }
          ]
        },
        "extended_entities": {
          "media": [...]
        }
      },
      "1698765432100000000": {
        "id_str": "1698765432100000000",
        "full_text": "Another bookmarked tweet...",
        ...
      }
    },
    "users": {
      "1669047598974369792": {
        "id_str": "1669047598974369792",
        "name": "Ben Rasmussen",
        "screen_name": "SalesBlastBen",
        "profile_image_url_https": "https://pbs.twimg.com/profile_images/.../photo_normal.jpg",
        "profile_banner_url": "https://pbs.twimg.com/profile_banners/...",
        "description": "I will get you more clients with Cold Email",
        "followers_count": 1655,
        "friends_count": 808,
        "statuses_count": 1694,
        "location": "The Moon",
        "verified": false,
        "created_at": "Wed Jun 14 18:22:20 +0000 2023"
      }
    }
  },
  "timeline": {
    "instructions": [
      {
        "addEntries": {
          "entries": [
            {
              "entryId": "tweet-1701253017100517398",
              "sortIndex": "7522119019754258409",
              "content": {
                "item": {
                  "content": {
                    "tweet": {
                      "id": "1701253017100517398"
                    }
                  }
                }
              }
            }
          ]
        }
      }
    ]
  }
}
```

**Key difference from GraphQL:** The v1 response has a flat `globalObjects` dictionary with `tweets` and `users` as separate maps. The GraphQL response nests user data inside each tweet.

### After the extension processes it:

```js
// The merge step:
tweets = tweets.map(tweet => ({ ...tweet, user: users[tweet.user_id_str] }))
```

Each tweet object in the `useState` array looks like:

```js
{
  // ─── Tweet identity ───
  id_str: "1701253017100517398",
  conversation_id_str: "1701253017100517398",
  user_id_str: "1669047598974369792",

  // ─── Tweet content ───
  full_text: "Cold Email 101\n\nOver the past month, I've closed 5 clients...",
  lang: "en",
  created_at: "Mon Sep 11 15:15:01 +0000 2023",  // string, not unix timestamp

  // ─── Engagement metrics ───
  favorite_count: 47,
  retweet_count: 12,
  reply_count: 5,
  quote_count: 0,
  // NOTE: no views_count — the v1 API didn't return view counts

  // ─── Flags ───
  is_quote_status: false,
  possibly_sensitive: false,
  favorited: false,
  retweeted: false,

  // ─── Entities (links, mentions, hashtags, media) ───
  entities: {
    urls: [
      {
        url: "https://t.co/abc123",
        expanded_url: "https://blog.example.com/article",
        display_url: "blog.example.com/article",
        indices: [120, 143]
      }
    ],
    user_mentions: [
      { screen_name: "someuser", name: "Some User", id_str: "999", indices: [0, 9] }
    ],
    hashtags: [
      { text: "coldemail", indices: [50, 60] }
    ],
    media: [
      {
        media_url_https: "https://pbs.twimg.com/media/F5xyz.jpg",
        type: "photo",    // "photo" | "video" | "animated_gif"
        url: "https://t.co/medialink",
        sizes: {
          large:  { w: 1920, h: 1080, resize: "fit" },
          medium: { w: 1200, h: 675,  resize: "fit" },
          small:  { w: 680,  h: 383,  resize: "fit" },
          thumb:  { w: 150,  h: 150,  resize: "crop" }
        }
      }
    ]
  },

  // ─── Extended entities (higher quality media data) ───
  extended_entities: {
    media: [
      {
        media_url_https: "https://pbs.twimg.com/media/F5xyz.jpg",
        type: "photo",
        video_info: {                    // only present for videos
          duration_millis: 30000,
          variants: [
            { bitrate: 2176000, content_type: "video/mp4", url: "..." },
            { bitrate: 832000,  content_type: "video/mp4", url: "..." }
          ]
        }
      }
    ]
  },

  // ─── Reply info (if this tweet is a reply) ───
  in_reply_to_status_id_str: null,       // or "1234567890"
  in_reply_to_user_id_str: null,
  in_reply_to_screen_name: null,

  // ─── Quote tweet info ───
  quoted_status_id_str: null,            // or "1234567890"
  quoted_status_permalink: null,         // or { url, expanded, display }

  // ─── Source app ───
  source: '<a href="https://tweethunter.io" rel="nofollow">Tweet Hunter Pro</a>',

  // ─── MERGED IN: Author's full user object ───
  user: {
    id_str: "1669047598974369792",
    name: "Ben Rasmussen",
    screen_name: "SalesBlastBen",
    profile_image_url_https: "https://pbs.twimg.com/profile_images/.../photo_normal.jpg",
    profile_banner_url: "https://pbs.twimg.com/profile_banners/...",
    description: "I will get you more clients with Cold Email | Harvard Grad '16",
    location: "The Moon",
    followers_count: 1655,
    friends_count: 808,
    favourites_count: 2824,
    statuses_count: 1694,
    listed_count: 9,
    media_count: 148,
    created_at: "Wed Jun 14 18:22:20 +0000 2023",
    verified: false,
    default_profile: true,
    default_profile_image: false,
    // NOTE: the user object has its OWN entities for profile links
    entities: {
      description: {
        urls: [
          { display_url: "SalesBlast.io", expanded_url: "http://SalesBlast.io", url: "https://t.co/..." }
        ]
      },
      url: {
        urls: [
          { display_url: "calendly.com/ben-ndo/intro-…", expanded_url: "https://calendly.com/..." }
        ]
      }
    }
  }
}
```

---

## What's Used for Search

The search uses `matchSorter` library — a fuzzy matching library:

```js
const results = matchSorter(tweets, query, {
  keys: [
    { key: "full_text",         threshold: matchSorter.rankings.ACRONYM },
    { key: "user.screen_name",  threshold: matchSorter.rankings.ACRONYM },
    { key: "user.name",         threshold: matchSorter.rankings.ACRONYM },
  ],
  keepDiacritics: true,
})
```

Only **3 fields** are searchable:
1. `full_text` — the tweet content
2. `user.screen_name` — the @handle
3. `user.name` — the display name

### What's Used for Display

The `TweetResult` component uses:

```jsx
<img src={tweet.user.profile_image_url_https} />    // avatar
<span>{tweet.user.name}</span>                       // display name
<span>@{tweet.user.screen_name}</span>               // @handle
<div innerHTML={tweet2Html(tweet, tweet.user.screen_name)} />  // rendered tweet
```

The `tweet2Html` library converts the raw tweet object (with entities) into HTML,
resolving @mentions into links, expanding t.co URLs, embedding media, etc.

---

## Comparison: Old vs New Extension Storage

| Aspect | twitter-bookmarks-search (old) | Twillot (new) |
|--------|-------------------------------|---------------|
| **Storage engine** | None — React `useState` in memory | IndexedDB (`twillot` database) |
| **Persistence** | Lost on page reload | Persists forever |
| **API used** | v1 REST: `api.twitter.com/2/timeline/bookmark.json` | GraphQL: `x.com/i/api/graphql/.../Bookmarks` |
| **Max bookmarks** | `count=10000` in single request | 100 per page, cursor-paginates through ALL |
| **Auth storage** | In-memory variables only | `chrome.storage.local` per user |
| **Multi-account** | No | Yes (per-user key scoping) |
| **User detection** | None — no concept of "who is logged in" | Reads `twid` cookie |
| **Offline search** | No — requires fresh API call each page load | Yes — searches local IndexedDB |
| **Search method** | `matchSorter` fuzzy search on 3 fields | IndexedDB cursor with filters on 12+ indexed fields |
| **Folders/tags** | No | Yes |
| **Response format** | Flat `globalObjects.tweets` + `globalObjects.users` (separate dictionaries) | Nested `tweet_results.result.core.user_results` (user embedded in tweet) |
| **Data per tweet** | ~40+ fields (raw API dump, unprocessed) | ~35 fields (extracted, flattened, enriched with computed booleans) |
| **Manifest version** | v2 | v3 |

---

## Why the Old Approach is Simple But Limited

### Advantages:
- **~100 lines of actual logic** — dead simple to understand
- **No database migrations, no schema, no indexes**
- **No storage permissions needed** beyond webRequest
- **Fresh data every time** — always up to date

### Limitations:
- **Reload = lose everything.** Every page load re-fetches all bookmarks from the API
- **10,000 bookmark cap** — the `count=10000` param is the max Twitter allows on this endpoint. Users with more bookmarks can't search them all
- **v1 API is dead** — Twitter shut down `api.twitter.com/2/timeline/bookmark.json` when they moved to x.com. This endpoint no longer works
- **No offline access** — Must be on twitter.com/bookmarks page to use
- **Rate limiting risk** — Fetching ALL bookmarks on every page load is expensive. With 5,000 bookmarks, that's a massive JSON payload every single time
- **No pagination** — Single request, single response. If it fails, get nothing

### The v1 API endpoint (`bookmark.json`) is DEAD

This is the critical issue. The old extension used:
```
https://api.twitter.com/2/timeline/bookmark.json
```

Twitter deprecated this when they migrated to x.com. The new GraphQL endpoint is:
```
https://x.com/i/api/graphql/{queryId}/Bookmarks
```

**If you're building a new extension, you MUST use the GraphQL endpoint.** The old REST API no longer works.
