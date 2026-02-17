import type { Bookmark } from "../../types";
import { formatDate, formatNumber } from "./utils";

export function TweetMetrics({
  bookmark,
}: {
  bookmark: Bookmark;
}) {
  return (
    <section className="mt-6 border-t border-x-border pt-4">
      <p className="text-sm text-x-text-secondary">
        {formatDate(bookmark.createdAt)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-x-text-secondary">
          <span className="font-bold text-x-text">
            {formatNumber(bookmark.metrics.retweets)}
          </span>{" "}
          Reposts
        </span>
        <span className="text-x-text-secondary">
          <span className="font-bold text-x-text">
            {formatNumber(bookmark.metrics.likes)}
          </span>{" "}
          Likes
        </span>
        <span className="text-x-text-secondary">
          <span className="font-bold text-x-text">
            {formatNumber(bookmark.metrics.views)}
          </span>{" "}
          Views
        </span>
        <span className="text-x-text-secondary">
          <span className="font-bold text-x-text">
            {formatNumber(bookmark.metrics.bookmarks)}
          </span>{" "}
          Bookmarks
        </span>
      </div>
    </section>
  );
}
