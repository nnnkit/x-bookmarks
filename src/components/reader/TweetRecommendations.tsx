import type { Bookmark } from "../../types";
import { TweetKindPill } from "./TweetHeader";
import { compactPreview, resolveTweetKind } from "./utils";

export function TweetRecommendations({
  relatedBookmarks,
  onOpenBookmark,
  onShuffle,
}: {
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onShuffle?: () => void;
}) {
  if (relatedBookmarks.length === 0) return null;

  return (
    <section className="mt-8 border-t border-x-border pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-balance text-x-text">
          Recommended bookmarks
        </h2>
        <div className="flex items-center gap-2">
          {onShuffle && (
            <button
              type="button"
              onClick={onShuffle}
              className="p-1.5 rounded-full text-x-text-secondary hover:text-x-blue hover:bg-x-blue/10 transition-colors"
              aria-label="Shuffle recommendations"
              title="Shuffle recommendations"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                <path d="M18 4l3 3-3 3-1.41-1.41L17.17 8H15c-1.1 0-2.08.53-2.73 1.33l-.93 1.17-1.58-1.25.93-1.17C11.6 6.81 13.22 6 15 6h2.17l-.58-.59L18 4zm0 12l3 3-3 3-1.41-1.41.58-.59H15c-1.78 0-3.4-.81-4.31-2.08L5.84 12l4.85-6.92C11.6 3.81 13.22 3 15 3h2.17l-.58-.59L18 1l3 3-3 3-1.41-1.41.58-.59H15c-1.1 0-2.08.53-2.73 1.33L7.58 12l4.69 6.67C12.92 19.47 13.9 20 15 20h2.17l-.58-.59L18 18z" />
              </svg>
            </button>
          )}
          <span className="text-xs text-x-text-secondary">3 picks</span>
        </div>
      </div>

      <div className="grid gap-3">
        {relatedBookmarks.slice(0, 3).map((related) => (
          <button
            key={related.tweetId}
            type="button"
            onClick={() => onOpenBookmark(related)}
            className="w-full rounded-2xl border border-x-border bg-x-card/70 p-4 text-left transition-colors hover:bg-x-hover"
          >
            <div className="flex items-center gap-2">
              <img
                src={related.author.profileImageUrl}
                alt=""
                className="size-7 rounded-full"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-x-text">
                  {related.author.name}
                </p>
                <p className="truncate text-xs text-x-text-secondary">
                  @{related.author.screenName}
                </p>
              </div>
              <div className="ml-auto">
                <TweetKindPill kind={resolveTweetKind(related)} />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-pretty text-x-text">
              {compactPreview(related.text)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
