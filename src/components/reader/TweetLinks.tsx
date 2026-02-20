import { ArrowSquareOut, Check } from "@phosphor-icons/react";
import type { LinkCard, TweetUrl } from "../../types";

type ResolvedUrl = {
  href: string;
  displayUrl: string;
  card?: LinkCard;
};

interface LinkPreviewCardProps {
  url: ResolvedUrl;
  card: LinkCard;
}

function LinkPreviewCard({ url, card }: LinkPreviewCardProps) {
  return (
    <a
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex overflow-hidden rounded-xl border border-x-border bg-x-link-card transition-colors hover:bg-x-hover"
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.imageAlt || card.title || ""}
          className="size-28 shrink-0 object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center px-3 py-2.5">
        <span className="truncate text-xs text-x-text-secondary">
          {card.domain || url.displayUrl}
        </span>
        <span className="mt-0.5 text-sm font-medium text-x-text line-clamp-1">
          {card.title}
        </span>
        {card.description && (
          <span className="mt-0.5 text-xs text-x-text-secondary line-clamp-2">
            {card.description}
          </span>
        )}
      </div>
    </a>
  );
}

interface LinkCardsProps {
  urls: ResolvedUrl[];
}

function LinkCards({ urls }: LinkCardsProps) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {urls.map((url, index) =>
        url.card?.title ? (
          <LinkPreviewCard
            key={`${url.href}-${index}`}
            url={url}
            card={url.card}
          />
        ) : (
          <a
            key={`${url.href}-${index}`}
            href={url.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-x-border bg-x-link-card px-4 py-3 transition-colors hover:bg-x-hover"
          >
            <span className="text-sm text-x-blue">{url.displayUrl}</span>
            {url.displayUrl !== url.href && (
              <span className="mt-1 block text-xs text-x-text-secondary">
                {url.href}
              </span>
            )}
          </a>
        ),
      )}
    </div>
  );
}

interface ReadStatusButtonProps {
  onToggle: () => void;
  isRead: boolean;
}

function ReadStatusButton({ onToggle, isRead }: ReadStatusButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        isRead
          ? "inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:border-green-500/50 hover:bg-green-500/20 dark:text-green-400"
          : "inline-flex items-center gap-1.5 rounded-full border border-x-border bg-x-card px-3 py-1.5 text-xs font-medium text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
      }
    >
      <Check weight="bold" className="size-3.5" />
      {isRead ? "Read" : "Mark as read"}
    </button>
  );
}

interface Props {
  urls: TweetUrl[];
  viewOnXUrl?: string;
  onToggleRead?: () => void;
  isMarkedRead?: boolean;
}

export function TweetLinks({
  urls,
  viewOnXUrl,
  onToggleRead,
  isMarkedRead,
}: Props) {
  const resolvedUrls: ResolvedUrl[] = urls.flatMap((url) => {
    const href = (url.expandedUrl || url.url || "").trim();
    if (!href) return [];
    return [
      { href, displayUrl: (url.displayUrl || href).trim(), card: url.card },
    ];
  });

  const readStatusBtn = onToggleRead ? (
    <ReadStatusButton
      onToggle={onToggleRead}
      isRead={isMarkedRead ?? false}
    />
  ) : null;

  const viewOnXLink = viewOnXUrl ? (
    <a
      href={viewOnXUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-x-text-secondary transition-colors hover:text-x-text"
    >
      View on X
      <ArrowSquareOut className="size-3.5" />
    </a>
  ) : null;

  const hasActions = readStatusBtn || viewOnXLink;

  return (
    <>
      <LinkCards urls={resolvedUrls} />
      {hasActions && (
        <div className="mt-5 flex items-center justify-end gap-3">
          {viewOnXLink}
          {readStatusBtn}
        </div>
      )}
    </>
  );
}
