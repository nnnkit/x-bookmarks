import { ArrowsClockwise } from "@phosphor-icons/react";
import type { Bookmark } from "../../types";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../../lib/bookmark-utils";

interface Props {
  bookmark: Bookmark | null;
  onOpen: (bookmark: Bookmark) => void;
  onShuffle: () => void;
}

export function PopupSuggestion({ bookmark, onOpen, onShuffle }: Props) {
  if (!bookmark) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-sm text-x-text-secondary">
          No bookmarks yet. Save some on X to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-xl border border-x-border bg-x-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-x-blue">
            Pick for you
          </p>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Show different suggestion"
            title="Show another"
            className="rounded-full p-1 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
          >
            <ArrowsClockwise className="size-4" />
          </button>
        </div>
        <h2 className="mt-2 text-sm font-semibold leading-snug text-x-text">
          {pickTitle(bookmark)}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-x-text-secondary line-clamp-3">
          {pickExcerpt(bookmark)}
        </p>
        <p className="mt-2 text-xs text-x-text-secondary">
          @{bookmark.author.screenName} &middot;{" "}
          {estimateReadingMinutes(bookmark)} min
        </p>
        <button
          type="button"
          onClick={() => onOpen(bookmark)}
          className="mt-3 w-full rounded-lg bg-x-blue px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Read now &rarr;
        </button>
      </div>
    </div>
  );
}
