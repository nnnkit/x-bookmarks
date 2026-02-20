import type { Bookmark, ThreadTweet, TweetKind } from "../../types";
import {
  normalizeText,
  resolveTweetKind,
  toEmbeddedReaderTweet,
} from "./utils";
import { estimateReadingMinutes } from "../../lib/bookmark-utils";
import { TweetHeader } from "./TweetHeader";
import { RichTextBlock } from "./TweetText";
import { TweetMedia } from "./TweetMedia";
import { TweetQuote } from "./TweetQuote";
import { TweetArticle } from "./TweetArticle";
import { TweetUrls } from "./TweetUrls";

import { TweetRecommendations } from "./TweetRecommendations";
import type { ReaderTweet } from "./types";

interface TweetBodyProps {
  tweet: ReaderTweet;
  compact?: boolean;
  sectionIdPrefix?: string;
  viewOnXUrl?: string;
  onMarkAsRead?: () => void;
  isMarkedRead?: boolean;
}

function TweetBody({ tweet, compact = false, sectionIdPrefix, viewOnXUrl, onMarkAsRead, isMarkedRead }: TweetBodyProps) {
  const kind = resolveTweetKind(tweet);

  if (kind === "repost" && tweet.retweetedTweet) {
    const repostComment =
      normalizeText(tweet.text) !== normalizeText(tweet.retweetedTweet.text)
        ? tweet.text
        : "";

    return (
      <>
        {repostComment && (
          <RichTextBlock text={repostComment} compact={compact} style="tweet" />
        )}
        <div className="mt-4 rounded-2xl border border-x-border p-4">
          <p className="text-xs uppercase text-x-text-secondary">
            Reposted content
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <img
              src={tweet.retweetedTweet.author.profileImageUrl}
              alt=""
              className="size-7 rounded-full"
              loading="lazy"
            />
            <span className="truncate font-semibold text-x-text">
              {tweet.retweetedTweet.author.name}
            </span>
            <span className="truncate text-x-text-secondary">
              @{tweet.retweetedTweet.author.screenName}
            </span>
          </div>
          <div className="mt-3">
            <TweetBody
              tweet={toEmbeddedReaderTweet(tweet.retweetedTweet)}
              compact
            />
          </div>
        </div>
      </>
    );
  }

  const articleText = tweet.article?.plainText?.trim() || "";
  const hasArticle = articleText.length > 0 && tweet.article;
  const textMatchesArticle =
    hasArticle && normalizeText(articleText) === normalizeText(tweet.text);

  const isArticleKind = kind === "article" && hasArticle;
  const hasArticleBlocks = Boolean(tweet.article?.contentBlocks?.length);

  const showArticle =
    hasArticle && (isArticleKind || !textMatchesArticle || hasArticleBlocks);
  const showText = !((isArticleKind || hasArticleBlocks) && textMatchesArticle);

  return (
    <>
      {showText && (
        <RichTextBlock
          text={tweet.text}
          compact={compact}
          style="tweet"
          sectionIdPrefix={sectionIdPrefix}
        />
      )}

      <TweetMedia items={tweet.media} bleed={!compact} />
      <TweetQuote quotedTweet={tweet.quotedTweet || null} />

      {showArticle && (
        <TweetArticle
          article={tweet.article!}
          compact={compact}
          authorProfileImageUrl={tweet.author?.profileImageUrl}
        />
      )}

      <TweetUrls
        urls={tweet.urls}
        viewOnXUrl={viewOnXUrl}
        onMarkAsRead={onMarkAsRead}
        isMarkedRead={isMarkedRead}
      />
    </>
  );
}

interface ThreadTweetsProps {
  tweets: ThreadTweet[];
}

function ThreadTweets({ tweets }: ThreadTweetsProps) {
  if (tweets.length === 0) return null;

  return (
    <section className="mt-8 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-x-text-secondary">
        Thread
      </p>
      {tweets.map((tweet, index) => (
        <article
          key={tweet.tweetId}
          id={`section-thread-${index + 1}`}
          className="rounded-2xl border border-x-border p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-xs text-x-text-secondary">
            <span className="font-medium text-x-text">#{index + 1}</span>
            <span>•</span>
            <span>@{tweet.author.screenName}</span>
          </div>
          <TweetBody tweet={tweet} compact />
        </article>
      ))}
    </section>
  );
}

interface Props {
  displayBookmark: Bookmark;
  displayKind: TweetKind;
  detailThread: ThreadTweet[];
  detailLoading: boolean;
  detailError: string | null;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onShuffle?: () => void;
  tweetSectionIdPrefix?: string;
  onMarkAsRead?: () => void;
  isMarkedRead?: boolean;
}

export function TweetRenderer({
  displayBookmark,
  displayKind,
  detailThread,
  detailLoading,
  detailError,
  relatedBookmarks,
  onOpenBookmark,
  onShuffle,
  tweetSectionIdPrefix,
  onMarkAsRead,
  isMarkedRead,
}: Props) {
  return (
    <div>
      <TweetHeader
        author={displayBookmark.author}
        displayKind={displayKind}
        readingMinutes={estimateReadingMinutes(displayBookmark)}
      />

      <div id="section-main-tweet" className="px-6">
        <TweetBody
          tweet={displayBookmark}
          sectionIdPrefix={tweetSectionIdPrefix}
          viewOnXUrl={`https://x.com/${displayBookmark.author.screenName}/status/${displayBookmark.tweetId}`}
          onMarkAsRead={onMarkAsRead}
          isMarkedRead={isMarkedRead}
        />
        <ThreadTweets tweets={detailThread} />
      </div>

      {detailLoading && (
        <div className="mt-6 flex items-center gap-3 px-6 py-4 text-sm text-x-text-secondary">
          <div className="size-4 animate-spin rounded-full border-2 border-x-blue border-t-transparent" />
          Loading details...
        </div>
      )}

      {detailError && (
        <p className="mt-6 px-6 py-2 text-sm text-x-text-secondary">
          Could not load complete post details. Showing cached bookmark data.
        </p>
      )}

      <div className="px-6">
        <TweetRecommendations
          relatedBookmarks={relatedBookmarks}
          onOpenBookmark={onOpenBookmark}
          onShuffle={onShuffle}
        />
      </div>
    </div>
  );
}
