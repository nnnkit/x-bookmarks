interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onExportApiDocs: () => void;
  syncing: boolean;
  exportingDocs: boolean;
  bookmarkCount: number;
}

export function SearchBar({
  query,
  onQueryChange,
  onRefresh,
  onExportApiDocs,
  syncing,
  exportingDocs,
  bookmarkCount,
}: SearchBarProps) {
  return (
    <div className="sticky top-0 z-10 bg-x-bg/80 backdrop-blur-md border-b border-x-border">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
        <svg viewBox="0 0 24 24" className="w-7 h-7 text-x-blue shrink-0" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>

        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-x-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="currentColor">
            <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z" />
          </svg>
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
          <svg viewBox="0 0 24 24" className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
          </svg>
        </button>

        <button
          onClick={onExportApiDocs}
          disabled={exportingDocs}
          aria-label="Export GraphQL API docs"
          className="p-2 text-x-text-secondary hover:text-x-blue hover:bg-x-blue/10 rounded-full transition-colors disabled:opacity-50"
          title="Export GraphQL API docs"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8zm0 2.44L18.56 9H14zM6.5 4H12v6.5h6V19.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-15a.5.5 0 0 1 .5-.5z" />
          </svg>
        </button>

        <span className="text-x-text-secondary text-sm shrink-0 tabular-nums">
          {bookmarkCount}
        </span>
      </div>
    </div>
  );
}
