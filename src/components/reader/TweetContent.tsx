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
import { TweetLinks } from "./TweetLinks";

import { TweetRecommendations } from "./TweetRecommendations";
import type { ReaderTweet } from "./types";
import { cn } from "../../lib/cn";

interface TweetBodyProps {
  tweet: ReaderTweet;
  compact?: boolean;
  sectionIdPrefix?: string;
}

function stripCardUrls(text: string, urls: { url: string; expandedUrl: string }[]): string {
  if (urls.length === 0) return text;
  let result = text;
  for (const u of urls) {
    if (u.url) result = result.replaceAll(u.url, "");
    if (u.expandedUrl) result = result.replaceAll(u.expandedUrl, "");
  }
  return result.replace(/\n+$/, "").trimEnd();
}

function TweetBody({ tweet, compact = false, sectionIdPrefix }: TweetBodyProps) {
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

  const displayText = stripCardUrls(tweet.text, tweet.urls);

  return (
    <>
      {showText && (
        <RichTextBlock
          text={displayText}
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

      <TweetLinks urls={tweet.urls} />
    </>
  );
}

function formatThreadDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ThreadTweetsProps {
  tweets: ThreadTweet[];
}

function ThreadTweets({ tweets }: ThreadTweetsProps) {
  if (tweets.length === 0) return null;

  return (
    <section className="mt-8">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-x-text-secondary">
        Thread
      </p>
      <div>
        {tweets.map((tweet, index) => {
          const isLast = index === tweets.length - 1;
          return (
            <article
              key={tweet.tweetId}
              id={`section-thread-${index + 1}`}
              className="relative flex gap-3"
            >
              <div className="flex flex-col items-center">
                <img
                  src={tweet.author.profileImageUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-full"
                  loading="lazy"
                />
                {!isLast && (
                  <div className="mt-1 w-0.5 flex-1 bg-x-border" />
                )}
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-5")}>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="truncate font-bold text-x-text">
                    {tweet.author.name}
                  </span>
                  <span className="truncate text-x-text-secondary">
                    @{tweet.author.screenName}
                  </span>
                  <span className="text-x-text-secondary">&middot;</span>
                  <span className="shrink-0 text-x-text-secondary">
                    {formatThreadDate(tweet.createdAt)}
                  </span>
                </div>
                <div className="mt-1">
                  <TweetBody tweet={tweet} compact />
                </div>
              </div>
            </article>
          );
        })}
      </div>
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
  onToggleRead?: () => void;
  isMarkedRead?: boolean;
}

export function TweetContent({
  displayBookmark,
  displayKind,
  detailThread,
  detailLoading,
  detailError,
  relatedBookmarks,
  onOpenBookmark,
  onShuffle,
  tweetSectionIdPrefix,
  onToggleRead,
  isMarkedRead,
}: Props) {
  const viewOnXUrl = `https://x.com/${displayBookmark.author.screenName}/status/${displayBookmark.tweetId}`;

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
        />
        <ThreadTweets tweets={detailThread} />
        <TweetLinks
          urls={[]}
          viewOnXUrl={viewOnXUrl}
          onToggleRead={onToggleRead}
          isMarkedRead={isMarkedRead}
        />
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
