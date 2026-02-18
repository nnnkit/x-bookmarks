# Core API Calls

This folder contains the extension's primary API-call entrypoints so core data flows can be verified in one place.

## Auth
- `checkAuth()` -> runtime message `CHECK_AUTH`
- `startAuthCapture()` -> runtime message `START_AUTH_CAPTURE`
- `closeAuthTab()` -> runtime message `CLOSE_AUTH_TAB`
- `checkReauthStatus()` -> runtime message `REAUTH_STATUS`

## Bookmarks
- `fetchBookmarkPage(cursor?)` -> runtime message `FETCH_BOOKMARKS`
- `deleteBookmark(tweetId)` -> runtime message `DELETE_BOOKMARK`
- `getBookmarkEvents()` -> runtime message `GET_BOOKMARK_EVENTS`
- `ackBookmarkEvents(ids)` -> runtime message `ACK_BOOKMARK_EVENTS`

## Posts
- `fetchTweetDetail(tweetId)` -> runtime message `FETCH_TWEET_DETAIL`
- `fetchThread(tweetId)` -> helper wrapper over `fetchTweetDetail`

## Service worker network handlers
Runtime messages above are handled in:
- `public/service-worker.js`

Network calls made by the worker:
- `GET https://x.com/i/api/graphql/{queryId}/Bookmarks`
- `GET https://x.com/i/api/graphql/{queryId}/TweetDetail`
- `POST https://x.com/i/api/graphql/{queryId}/DeleteBookmark`
