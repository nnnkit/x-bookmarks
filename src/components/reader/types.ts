import type { Bookmark, Media, TweetKind, TweetUrl } from "../../types";

export type TocSection = {
  id: string;
  label: string;
  type: "main" | "thread" | "heading" | "paragraph-group";
};

export type ReaderTweet = {
  text: string;
  media: Media[];
  urls: TweetUrl[];
  article?: Bookmark["article"];
  quotedTweet?: Bookmark["quotedTweet"];
  retweetedTweet?: Bookmark["retweetedTweet"];
  inReplyToTweetId?: string;
  inReplyToScreenName?: string;
  isThread?: boolean;
  isLongText?: boolean;
  tweetKind?: TweetKind;
  tweetDisplayType?: string;
};

export const KIND_LABEL: Record<TweetKind, string> = {
  tweet: "Post",
  reply: "Reply",
  quote: "Quote",
  repost: "Repost",
  thread: "Thread",
  article: "Article",
};
