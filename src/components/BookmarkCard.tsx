import type { Bookmark } from "../types";
import { timeAgo } from "../lib/time";

interface BookmarkCardProps {
  bookmark: Bookmark;
  isFocused: boolean;
  onClick: () => void;
  onUnbookmark: () => void;
  unbookmarking: boolean;
}

export function BookmarkCard({
  bookmark,
  isFocused,
  onClick,
  onUnbookmark,
  unbookmarking,
}: BookmarkCardProps) {
  const { author, text, media } = bookmark;
  const coverImage =
    media.find((m) => m.type === "photo")?.url ||
    bookmark.article?.coverImageUrl ||
    "";

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
      className={`group relative aspect-square rounded-2xl border border-x-border bg-x-card overflow-hidden cursor-pointer transition-colors hover:border-x-text-secondary/40 ${
        isFocused ? "ring-2 ring-x-blue" : ""
      }`}
    >
      {coverImage && (
        <img
          src={coverImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}

      <div
        className={`absolute inset-0 flex flex-col justify-end p-3.5 ${
          coverImage
            ? "bg-gradient-to-t from-black/80 via-black/30 to-transparent"
            : ""
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <img
            src={author.profileImageUrl}
            alt=""
            className="size-6 rounded-full shrink-0"
            loading="lazy"
          />
          <span
            className={`text-xs font-semibold truncate ${
              coverImage ? "text-white" : "text-x-text"
            }`}
          >
            {author.name}
          </span>
          <span
            className={`text-xs shrink-0 ml-auto ${
              coverImage ? "text-white/60" : "text-x-text-secondary"
            }`}
          >
            {timeAgo(bookmark.createdAt)}
          </span>
        </div>

        <p
          className={`text-sm leading-snug line-clamp-3 ${
            coverImage ? "text-white/90" : "text-x-text"
          }`}
        >
          {text}
        </p>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onUnbookmark();
        }}
        disabled={unbookmarking}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white transition-all disabled:opacity-40"
        title="Remove bookmark"
        aria-label="Remove bookmark"
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-3.5 h-3.5 ${unbookmarking ? "animate-pulse" : ""}`}
          fill="currentColor"
        >
          <path d="M5.5 3h13A1.5 1.5 0 0120 4.5v17.72l-8-4.62-8 4.62V4.5A1.5 1.5 0 015.5 3zm0 1a.5.5 0 00-.5.5v15.99l7-4.04 7 4.04V4.5a.5.5 0 00-.5-.5h-13z" />
        </svg>
      </button>
    </div>
  );
}
