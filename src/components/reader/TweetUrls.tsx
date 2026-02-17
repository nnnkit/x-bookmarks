import type { TweetUrl } from "../../types";

export function TweetUrls({ urls }: { urls: TweetUrl[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {urls.map((url, index) => {
        const href = url.expandedUrl || url.url;
        if (!href) return null;

        return (
          <a
            key={`${href}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-x-border bg-x-link-card px-4 py-3 transition-colors hover:bg-x-hover"
          >
            <span className="text-sm text-x-blue">
              {url.displayUrl || href}
            </span>
            {url.displayUrl && (
              <span className="mt-1 block text-xs text-x-text-secondary">
                {href}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
