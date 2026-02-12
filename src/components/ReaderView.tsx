import { useEffect, useState } from "react";
import type { Bookmark, Media, ThreadTweet } from "../types";
import { fetchTweetDetail } from "../api/twitter";

const readerTextClass =
  "text-[1.125rem] leading-7 break-words whitespace-pre-wrap [&_a]:text-x-blue [&_a:hover]:underline";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function linkifyText(text: string): string {
  if (!text) return "";

  let out = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  out = out.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  out = out.replace(/@(\w+)/g, '<span class="text-x-blue">@$1</span>');
  out = out.replace(/#(\w+)/g, '<span class="text-x-blue">#$1</span>');

  return out;
}

function MediaBlock({ items }: { items: Media[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-3">
      {items.map((item, index) => {
        if (item.type === "video" || item.type === "animated_gif") {
          return item.videoUrl ? (
            <video
              key={`${item.url}-${index}`}
              src={item.videoUrl}
              controls
              loop={item.type === "animated_gif"}
              autoPlay={item.type === "animated_gif"}
              muted={item.type === "animated_gif"}
              playsInline
              className="w-full rounded-xl max-h-[70vh]"
              poster={item.url}
            />
          ) : (
            <img
              key={`${item.url}-${index}`}
              src={item.url}
              alt={item.altText || ""}
              className="w-full rounded-xl object-contain max-h-[70vh]"
              loading="lazy"
            />
          );
        }

        return (
          <img
            key={`${item.url}-${index}`}
            src={item.url}
            alt={item.altText || ""}
            className="w-full rounded-xl object-contain max-h-[70vh]"
            loading="lazy"
          />
        );
      })}
    </div>
  );
}

function QuotedTweetCard({ bookmark }: { bookmark: Bookmark }) {
  if (!bookmark.quotedTweet) return null;

  return (
    <div className="mt-5 border border-x-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <img
          src={bookmark.quotedTweet.author.profileImageUrl}
          alt=""
          className="w-6 h-6 rounded-full"
        />
        <span className="font-bold text-x-text text-sm">
          {bookmark.quotedTweet.author.name}
        </span>
        {bookmark.quotedTweet.author.verified && (
          <svg viewBox="0 0 22 22" className="w-4 h-4 text-x-blue" fill="currentColor">
            <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.538.354 1.167.551 1.813.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
          </svg>
        )}
        <span className="text-x-text-secondary text-sm">
          @{bookmark.quotedTweet.author.screenName}
        </span>
      </div>
      <div
        className="text-x-text text-sm whitespace-pre-wrap leading-relaxed"
        dangerouslySetInnerHTML={{ __html: linkifyText(bookmark.quotedTweet.text) }}
      />
      {bookmark.quotedTweet.media.length > 0 && (
        <img
          src={bookmark.quotedTweet.media[0].url}
          alt=""
          className="mt-3 w-full rounded-lg object-contain max-h-64"
          loading="lazy"
        />
      )}
    </div>
  );
}

interface ReaderViewProps {
  bookmark: Bookmark;
  onBack: () => void;
  onUnbookmark: (tweetId: string) => void;
  unbookmarking: boolean;
}

export function ReaderView({
  bookmark,
  onBack,
  onUnbookmark,
  unbookmarking,
}: ReaderViewProps) {
  const [resolvedBookmark, setResolvedBookmark] = useState<Bookmark | null>(null);
  const [thread, setThread] = useState<ThreadTweet[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setResolvedBookmark(null);
    setThread([]);
    setDetailError(null);
    setDetailLoading(true);

    fetchTweetDetail(bookmark.tweetId)
      .then((detail) => {
        if (cancelled) return;

        if (detail.focalTweet) {
          setResolvedBookmark({
            ...detail.focalTweet,
            sortIndex: bookmark.sortIndex,
          });
        }

        setThread(detail.thread);
      })
      .catch((error) => {
        if (cancelled) return;
        setDetailError(error instanceof Error ? error.message : "DETAIL_ERROR");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookmark.tweetId, bookmark.sortIndex]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [bookmark.tweetId]);

  const displayBookmark = resolvedBookmark || bookmark;
  const articleText = displayBookmark.article?.plainText?.trim() || "";
  const showArticle =
    articleText.length > 0 && articleText !== displayBookmark.text.trim();
  const showThreadSection =
    detailLoading || thread.length > 0 || displayBookmark.isThread;

  return (
    <div className="min-h-screen bg-x-bg">
      <div className="sticky top-0 z-10 bg-x-bg/80 backdrop-blur-md border-b border-x-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back to bookmarks"
            className="p-2 -ml-2 text-x-text hover:bg-x-hover rounded-full transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>
          <span className="text-x-text font-bold text-lg">Post</span>
          <button
            onClick={() => onUnbookmark(bookmark.tweetId)}
            disabled={unbookmarking}
            aria-label="Remove bookmark"
            className="ml-auto p-2 text-x-text-secondary hover:text-x-blue hover:bg-x-blue/10 rounded-full transition-colors disabled:opacity-50"
            title="Remove bookmark"
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 ${unbookmarking ? "animate-pulse" : ""}`}
              fill="currentColor"
            >
              <path d="M5.5 3h13A1.5 1.5 0 0120 4.5v17.72l-8-4.62-8 4.62V4.5A1.5 1.5 0 015.5 3zm0 1a.5.5 0 00-.5.5v15.99l7-4.04 7 4.04V4.5a.5.5 0 00-.5-.5h-13z" />
            </svg>
          </button>
        </div>
      </div>

      <article className="max-w-2xl mx-auto px-5 pt-6 pb-16">
        <div className="flex items-center gap-3 mb-5">
          <img
            src={displayBookmark.author.profileImageUrl}
            alt=""
            className="w-12 h-12 rounded-full"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-x-text truncate">
                {displayBookmark.author.name}
              </span>
              {displayBookmark.author.verified && (
                <svg
                  viewBox="0 0 22 22"
                  className="w-5 h-5 text-x-blue shrink-0"
                  fill="currentColor"
                >
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.538.354 1.167.551 1.813.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                </svg>
              )}
            </div>
            <span className="text-x-text-secondary text-sm">
              @{displayBookmark.author.screenName}
            </span>
          </div>
        </div>

        <div
          className={`${readerTextClass} text-x-text`}
          dangerouslySetInnerHTML={{ __html: linkifyText(displayBookmark.text) }}
        />

        <MediaBlock items={displayBookmark.media} />
        <QuotedTweetCard bookmark={displayBookmark} />

        {showArticle && (
          <section className="mt-6 pt-4 border-t border-x-border">
            {displayBookmark.article?.title && (
              <h2 className="text-x-text text-xl font-bold mb-3 text-balance">
                {displayBookmark.article.title}
              </h2>
            )}
            <div
              className={`${readerTextClass} text-x-text text-pretty`}
              dangerouslySetInnerHTML={{ __html: linkifyText(articleText) }}
            />
          </section>
        )}

        {displayBookmark.urls.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {displayBookmark.urls.map((url, index) => (
              <a
                key={`${url.expandedUrl}-${index}`}
                href={url.expandedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-x-border bg-x-link-card rounded-xl px-4 py-3 hover:bg-x-hover transition-colors"
              >
                <span className="text-x-blue text-sm">{url.displayUrl || url.expandedUrl}</span>
              </a>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-x-border">
          <p className="text-x-text-secondary text-sm">{formatDate(displayBookmark.createdAt)}</p>
          <div className="flex items-center gap-5 mt-2 text-sm">
            <span className="text-x-text-secondary">
              <span className="font-bold text-x-text">
                {formatNumber(displayBookmark.metrics.retweets)}
              </span>{" "}
              Reposts
            </span>
            <span className="text-x-text-secondary">
              <span className="font-bold text-x-text">
                {formatNumber(displayBookmark.metrics.likes)}
              </span>{" "}
              Likes
            </span>
            <span className="text-x-text-secondary">
              <span className="font-bold text-x-text">
                {formatNumber(displayBookmark.metrics.views)}
              </span>{" "}
              Views
            </span>
            <span className="text-x-text-secondary">
              <span className="font-bold text-x-text">
                {formatNumber(displayBookmark.metrics.bookmarks)}
              </span>{" "}
              Bookmarks
            </span>
          </div>
        </div>

        {showThreadSection && (
          <div className="mt-6 pt-4 border-t border-x-border">
            {detailLoading && (
              <div className="flex items-center gap-3 py-4 text-x-text-secondary text-sm">
                <div className="w-4 h-4 border-2 border-x-blue border-t-transparent rounded-full animate-spin" />
                Loading full thread...
              </div>
            )}

            {thread.length > 0 && (
              <div>
                {thread.map((tweet, index) => (
                  <div key={tweet.tweetId} className="relative pl-10 pb-6">
                    {index < thread.length - 1 && (
                      <div className="absolute left-[18px] top-10 bottom-0 w-0.5 bg-x-border" />
                    )}
                    <div className="absolute left-[18px] top-0 h-3 w-0.5 bg-x-border" />

                    <img
                      src={tweet.author.profileImageUrl}
                      alt=""
                      className="absolute left-0 top-3 w-9 h-9 rounded-full"
                    />

                    <div className="pt-3">
                      <div className="flex items-center gap-1.5 text-sm mb-1">
                        <span className="font-bold text-x-text">{tweet.author.name}</span>
                        <span className="text-x-text-secondary">@{tweet.author.screenName}</span>
                      </div>
                      <div
                        className={`${readerTextClass} text-x-text`}
                        dangerouslySetInnerHTML={{ __html: linkifyText(tweet.text) }}
                      />
                      <MediaBlock items={tweet.media} />
                      {tweet.article?.plainText &&
                        tweet.article.plainText.trim() !== tweet.text.trim() && (
                          <div
                            className={`${readerTextClass} mt-4 text-x-text text-pretty`}
                            dangerouslySetInnerHTML={{
                              __html: linkifyText(tweet.article.plainText),
                            }}
                          />
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!detailLoading && thread.length === 0 && displayBookmark.isThread && (
              <p className="text-x-text-secondary text-sm py-2">
                No thread continuation found.
              </p>
            )}

            {detailError && (
              <p className="text-x-text-secondary text-sm py-2">
                Could not load complete post details. Showing cached bookmark data.
              </p>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
