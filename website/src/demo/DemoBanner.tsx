export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-3 bg-x-blue/95 px-4 py-2 text-white">
      <span className="text-sm font-medium">
        You&apos;re viewing a demo of X Bookmarks Tab
      </span>
      <a
        href="https://chromewebstore.google.com"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
      >
        Install Extension &rarr;
      </a>
    </div>
  );
}
