import {
  ArrowLeft,
  ArrowsClockwise,
  GearSix,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { cn } from "../lib/cn";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  syncing: boolean;
  bookmarkCount: number;
  onBack?: () => void;
}

export function SearchBar({
  query,
  onQueryChange,
  onRefresh,
  onOpenSettings,
  syncing,
  bookmarkCount,
  onBack,
}: Props) {
  return (
    <div className="sticky top-0 z-10 bg-x-bg/80 backdrop-blur-md border-b border-x-border">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to home"
            title="Back"
            className="p-2 -ml-2 text-x-text-secondary hover:text-x-text hover:bg-x-hover rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <svg viewBox="0 0 24 24" className="w-7 h-7 text-x-blue shrink-0" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>

        <div className="relative flex-1">
          <MagnifyingGlass className="size-5 text-x-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-input"
            type="text"
            placeholder="Search bookmarks... (press /)"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="w-full bg-x-card text-x-text placeholder-x-text-secondary rounded-full py-2.5 pl-11 pr-4 border border-x-border focus:border-x-blue focus:outline-none transition-colors"
          />
        </div>

        <button
          onClick={onRefresh}
          disabled={syncing}
          aria-label="Sync bookmarks"
          className="p-2 text-x-text-secondary hover:text-x-blue hover:bg-x-blue/10 rounded-full transition-colors disabled:opacity-50"
          title="Sync bookmarks (top page)"
        >
          <ArrowsClockwise className={cn("size-5", syncing && "animate-spin")} />
        </button>

        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="p-2 text-x-text-secondary hover:text-x-blue hover:bg-x-blue/10 rounded-full transition-colors"
          title="Settings"
        >
          <GearSix className="size-5" />
        </button>

        <span className="text-x-text-secondary text-sm shrink-0 tabular-nums">
          {bookmarkCount}
        </span>
      </div>
    </div>
  );
}
