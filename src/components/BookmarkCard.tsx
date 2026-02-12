import type { Bookmark } from "../types";

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface BookmarkCardProps {
  bookmark: Bookmark;
  isFocused: boolean;
  onClick: () => void;
  onUnbookmark: () => void;
  unbookmarking: boolean;
}

function compactPreview(text: string, maxChars = 170): string {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trimEnd()}...`;
}

function MediaPreview({ bookmark }: { bookmark: Bookmark }) {
  const mediaItems = bookmark.media.slice(0, 4);
  const articleCoverImage = bookmark.article?.coverImageUrl || "";

  if (mediaItems.length === 0 && !articleCoverImage) return null;

  if (mediaItems.length === 0 && articleCoverImage) {
    return (
      <div className="mt-3 border border-x-border rounded-2xl overflow-hidden bg-x-card">
        <img
          src={articleCoverImage}
          alt={bookmark.article?.title || "Article cover image"}
          className="w-full max-h-[340px] object-cover"
          loading="lazy"
        />
        <div className="px-3 py-2.5 border-t border-x-border bg-x-link-card">
          {bookmark.article?.title && (
            <p className="text-x-text text-sm font-semibold line-clamp-2 text-balance">
              {bookmark.article.title}
            </p>
          )}
          {bookmark.article?.plainText && (
            <p className="text-x-text-secondary text-xs mt-1 line-clamp-2 text-pretty">
              {compactPreview(bookmark.article.plainText, 120)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const columns = mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className="mt-3 border border-x-border rounded-2xl overflow-hidden bg-x-border">
      <div className={`grid ${columns} gap-px`}>
        {mediaItems.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className={`bg-x-card overflow-hidden ${
              mediaItems.length === 3 && index === 0 ? "col-span-2" : ""
            }`}
          >
            <img
              src={item.url}
              alt={item.altText || ""}
              className={`w-full object-cover ${
                mediaItems.length === 1
                  ? "max-h-[340px]"
                  : mediaItems.length === 3 && index === 0
                    ? "h-56"
                    : "h-44"
              }`}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookmarkCard({
  bookmark,
  isFocused,
  onClick,
  onUnbookmark,
  unbookmarking,
}: BookmarkCardProps) {
  const { author, text, media, isThread, hasImage, hasVideo } = bookmark;

  const mediaCount = media.filter((m) => m.type === "photo").length;
  const videoCount = media.filter(
    (m) => m.type === "video" || m.type === "animated_gif",
  ).length;

  return (
    <div
      data-bookmark-id={bookmark.id}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={`w-full text-left px-5 py-4 transition-colors hover:bg-x-hover/70 cursor-pointer ${
        isFocused ? "bg-x-hover" : ""
      }`}
    >
      <div className="flex gap-3">
        <img
          src={author.profileImageUrl}
          alt=""
          className="w-10 h-10 rounded-full shrink-0"
          loading="lazy"
        />

        <div className="min-w-0 flex-1">
          {/* Author line */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-bold text-x-text truncate">
              {author.name}
            </span>
            {author.verified && (
              <svg
                viewBox="0 0 22 22"
                className="w-4 h-4 text-x-blue shrink-0"
                fill="currentColor"
              >
                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.538.354 1.167.551 1.813.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
              </svg>
            )}
            <span className="text-x-text-secondary truncate">
              @{author.screenName}
            </span>
            <span className="text-x-text-secondary shrink-0">
              · {timeAgo(bookmark.createdAt)}
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onUnbookmark();
              }}
              disabled={unbookmarking}
              className="ml-auto p-1 text-x-text-secondary hover:text-x-blue rounded transition-colors disabled:opacity-40"
              title="Remove bookmark"
              aria-label="Remove bookmark"
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-4 h-4 ${unbookmarking ? "animate-pulse" : ""}`}
                fill="currentColor"
              >
                <path d="M5.5 3h13A1.5 1.5 0 0120 4.5v17.72l-8-4.62-8 4.62V4.5A1.5 1.5 0 015.5 3zm0 1a.5.5 0 00-.5.5v15.99l7-4.04 7 4.04V4.5a.5.5 0 00-.5-.5h-13z" />
              </svg>
            </button>
          </div>

          {/* Preview text */}
          <p className="text-x-text text-[15px] leading-snug mt-1 line-clamp-2">
            {text}
          </p>

          <MediaPreview bookmark={bookmark} />

          {/* Indicators */}
          <div className="flex items-center gap-3 mt-2 text-xs text-x-text-secondary">
            {mediaCount > 0 && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M1.75 2h20.5c.966 0 1.75.784 1.75 1.75v16.5A1.75 1.75 0 0122.25 22H1.75A1.75 1.75 0 010 20.25V3.75C0 2.784.784 2 1.75 2zm0 1.5a.25.25 0 00-.25.25v16.5c0 .138.112.25.25.25h20.5a.25.25 0 00.25-.25V3.75a.25.25 0 00-.25-.25H1.75zM8 10a2 2 0 11-4.001-.001A2 2 0 018 10zm-1 4.19l2.72-2.72a.75.75 0 011.06 0l2.72 2.72 4.72-4.72a.75.75 0 011.06 0l2.22 2.22V19H3.5v-1.81l3.5-3z" />
                </svg>
                {mediaCount}
              </span>
            )}
            {videoCount > 0 && (
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {videoCount}
              </span>
            )}
            {isThread && (
              <span className="text-x-blue">Thread</span>
            )}
            {bookmark.quotedTweet && (
              <span>Quote</span>
            )}
            {hasImage && !mediaCount && <span>Image</span>}
            {hasVideo && !videoCount && <span>Video</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
