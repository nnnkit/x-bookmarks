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

export interface ArticleContentBlock {
  type: string;
  text: string;
  inlineStyleRanges: Array<{ offset: number; length: number; style: string }>;
  entityRanges: Array<{ offset: number; length: number; key: number }>;
  depth: number;
}

export interface ArticleContentEntity {
  type: string;
  data: Record<string, unknown>;
}

export interface ArticleContent {
  title?: string;
  plainText: string;
  coverImageUrl?: string;
  contentBlocks?: ArticleContentBlock[];
  entityMap?: Record<string, ArticleContentEntity>;
}

export type TweetKind =
  | "tweet"
  | "reply"
  | "quote"
  | "repost"
  | "thread"
  | "article";

export interface QuotedTweet {
  tweetId: string;
  text: string;
  createdAt: number;
  author: Author;
  media: Media[];
  urls?: TweetUrl[];
  article?: ArticleContent | null;
}

export interface ThreadTweet {
  tweetId: string;
  text: string;
  createdAt: number;
  author: Author;
  media: Media[];
  urls: TweetUrl[];
  article?: ArticleContent | null;
  quotedTweet?: QuotedTweet | null;
  retweetedTweet?: QuotedTweet | null;
  tweetKind?: TweetKind;
  tweetDisplayType?: string;
  inReplyToTweetId?: string;
  inReplyToScreenName?: string;
  isThread?: boolean;
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
  retweetedTweet?: QuotedTweet | null;
  article?: ArticleContent | null;
  tweetKind?: TweetKind;
  tweetDisplayType?: string;
  inReplyToTweetId?: string;
  inReplyToScreenName?: string;
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

export type WidgetStyle = "stack" | "swiper" | "filmstrip";
export type WallpaperSource = "bing" | "wikimedia";

export interface UserSettings {
  showBookmarkStack: boolean;
  stackSize: number;
  showTopSites: boolean;
  widgetStyle: WidgetStyle;
  wallpaperSource: WallpaperSource;
}
