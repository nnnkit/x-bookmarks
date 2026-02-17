import type { Bookmark } from "../../types";
import { normalizeText } from "./utils";
import { RichTextBlock } from "./TweetText";
import { TweetMedia } from "./TweetMedia";
import { TweetUrls } from "./TweetUrls";

export function TweetQuote({
  quotedTweet,
}: {
  quotedTweet: Bookmark["quotedTweet"];
}) {
  if (!quotedTweet) return null;

  const articleText = quotedTweet.article?.plainText?.trim() || "";
  const showArticle =
    articleText.length > 0 &&
    normalizeText(articleText) !== normalizeText(quotedTweet.text);

  return (
    <div className="mt-5 rounded-2xl border border-x-border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <img
          src={quotedTweet.author.profileImageUrl}
          alt=""
          className="size-6 rounded-full"
          loading="lazy"
        />
        <span className="truncate font-semibold text-x-text">
          {quotedTweet.author.name}
        </span>
        <span className="truncate text-x-text-secondary">
          @{quotedTweet.author.screenName}
        </span>
      </div>

      <RichTextBlock
        text={quotedTweet.text}
        compact
        style="tweet"
      />

      <TweetMedia items={quotedTweet.media} />

      {showArticle && (
        <section className="mt-5 rounded-2xl border border-x-border bg-x-link-card px-4 py-3">
          {quotedTweet.article?.title && (
            <h3 className="text-base font-semibold text-balance text-x-text">
              {quotedTweet.article.title}
            </h3>
          )}
          <div className="mt-2">
            <RichTextBlock
              text={articleText}
              compact
              style="article"
            />
          </div>
        </section>
      )}

      {quotedTweet.urls && quotedTweet.urls.length > 0 && (
        <TweetUrls urls={quotedTweet.urls} />
      )}
    </div>
  );
}
