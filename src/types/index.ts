export interface Author {
  name: string;
  screenName: string;
  profileImageUrl: string;
  verified: boolean;
}

export interface Metrics {
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  bookmarks: number;
}

export interface Media {
  type: "photo" | "video" | "animated_gif";
  url: string;
  videoUrl?: string;
  width: number;
  height: number;
  altText?: string;
}

export interface TweetUrl {
  url: string;
  displayUrl: string;
  expandedUrl: string;
}

export interface ArticleContent {
  title?: string;
  plainText: string;
  coverImageUrl?: string;
}

export interface QuotedTweet {
  tweetId: string;
  text: string;
  createdAt: number;
  author: Author;
  media: Media[];
}

export interface ThreadTweet {
  tweetId: string;
  text: string;
  createdAt: number;
  author: Author;
  media: Media[];
  urls: TweetUrl[];
  article?: ArticleContent | null;
}

export interface Bookmark {
  id: string;
  tweetId: string;
  text: string;
  createdAt: number;
  sortIndex: string;
  author: Author;
  metrics: Metrics;
  media: Media[];
  urls: TweetUrl[];
  isThread: boolean;
  hasImage: boolean;
  hasVideo: boolean;
  hasLink: boolean;
  isLongText: boolean;
  quotedTweet: QuotedTweet | null;
  article?: ArticleContent | null;
}

export interface TweetDetailCache {
  tweetId: string;
  fetchedAt: number;
  focalTweet: Bookmark | null;
  thread: ThreadTweet[];
}

export interface AuthStatus {
  hasUser: boolean;
  hasAuth: boolean;
  hasQueryId: boolean;
  userId: string | null;
}

export interface SyncState {
  phase: "idle" | "checking" | "syncing" | "done" | "error";
  total: number;
  error?: string;
}
