import type { Bookmark, TweetKind } from "../../types";
import { normalizeText, resolveTweetKind, toEmbeddedReaderTweet } from "./utils";
import { TweetHeader } from "./TweetHeader";
import { RichTextBlock } from "./TweetText";
import { TweetMedia } from "./TweetMedia";
import { TweetQuote } from "./TweetQuote";
import { TweetArticle } from "./TweetArticle";
import { TweetUrls } from "./TweetUrls";
import { TweetMetrics } from "./TweetMetrics";
import { TweetRecommendations } from "./TweetRecommendations";
import type { ReaderTweet } from "./types";

function TweetBody({
  tweet,
  compact = false,
  sectionIdPrefix,
}: {
  tweet: ReaderTweet;
  compact?: boolean;
  sectionIdPrefix?: string;
}) {
  const kind = resolveTweetKind(tweet);

  if (kind === "repost" && tweet.retweetedTweet) {
    const repostComment =
      normalizeText(tweet.text) !== normalizeText(tweet.retweetedTweet.text)
        ? tweet.text
        : "";

    return (
      <>
        {repostComment && (
          <RichTextBlock
            text={repostComment}
            compact={compact}
            style="tweet"
          />
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

  // Prefer rich article rendering when structured blocks exist (even for threads)
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

      <TweetMedia items={tweet.media} />
      <TweetQuote quotedTweet={tweet.quotedTweet || null} />

      {showArticle && (
        <TweetArticle
          article={tweet.article!}
          compact={compact}
        />
      )}

      <TweetUrls urls={tweet.urls} />
    </>
  );
}

export function TweetRenderer({
  displayBookmark,
  displayKind,
  detailLoading,
  detailError,
  relatedBookmarks,
  onOpenBookmark,
  onShuffle,
  tweetSectionIdPrefix,
}: {
  displayBookmark: Bookmark;
  displayKind: TweetKind;
  detailLoading: boolean;
  detailError: string | null;
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onShuffle?: () => void;
  tweetSectionIdPrefix?: string;
}) {
  return (
    <div>
      <TweetHeader
        author={displayBookmark.author}
        displayKind={displayKind}
        isLongText={displayBookmark.isLongText}
      />

      <div id="section-main-tweet">
        <TweetBody
          tweet={displayBookmark}
          sectionIdPrefix={tweetSectionIdPrefix}
        />
      </div>

      {detailLoading && (
        <div className="mt-6 flex items-center gap-3 py-4 text-sm text-x-text-secondary">
          <div className="size-4 animate-spin rounded-full border-2 border-x-blue border-t-transparent" />
          Loading details...
        </div>
      )}

      {detailError && (
        <p className="mt-6 py-2 text-sm text-x-text-secondary">
          Could not load complete post details. Showing cached bookmark data.
        </p>
      )}

      <TweetMetrics bookmark={displayBookmark} />

      <TweetRecommendations
        relatedBookmarks={relatedBookmarks}
        onOpenBookmark={onOpenBookmark}
        onShuffle={onShuffle}
      />
    </div>
  );
}
