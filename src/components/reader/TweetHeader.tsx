import { useState, useRef, useEffect, useCallback } from "react";
import type { Bookmark, TweetKind } from "../../types";
import { KIND_LABEL } from "./types";
import { kindPillClass } from "./utils";
import { cn } from "../../lib/cn";
import { formatCompactNumber } from "../../lib/text";

interface TweetKindPillProps {
  kind: TweetKind;
}

function TweetKindPill({ kind }: TweetKindPillProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", kindPillClass(kind))}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

export { TweetKindPill };

function formatJoinDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en", { month: "long", year: "numeric" });
}

interface AuthorCardProps {
  author: Bookmark["author"];
  closing: boolean;
  onClose: () => void;
}

function AuthorCard({ author, closing, onClose }: AuthorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const authorUrl = `https://x.com/${author.screenName}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "mb-4 overflow-hidden rounded-2xl border border-x-border bg-x-card",
        closing ? "animate-card-out" : "animate-card-in",
      )}
    >
      {author.bannerUrl && (
        <img
          src={author.bannerUrl}
          alt=""
          className="h-24 w-full object-cover"
          loading="lazy"
        />
      )}

      <div className="relative px-4 pb-4">
        <div className={author.bannerUrl ? "-mt-8" : "mt-4"}>
          <img
            src={author.profileImageUrl}
            alt=""
            className="size-16 rounded-full border-2 border-x-card"
            loading="lazy"
          />
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-1.5">
            <a
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-bold text-x-text hover:underline"
            >
              {author.name}
            </a>
            {author.verified && <VerifiedBadge />}
            {author.affiliate && (
              <AffiliateBadge affiliate={author.affiliate} />
            )}
          </div>
          <a
            href={authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-x-text-secondary hover:underline"
          >
            @{author.screenName}
          </a>
        </div>

        {author.bio && (
          <p className="mt-2 text-sm text-x-text">{author.bio}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {author.followingCount != null && (
            <span>
              <span className="font-semibold text-x-text">
                {formatCompactNumber(author.followingCount)}
              </span>{" "}
              <span className="text-x-text-secondary">Following</span>
            </span>
          )}
          {author.followersCount != null && (
            <span>
              <span className="font-semibold text-x-text">
                {formatCompactNumber(author.followersCount)}
              </span>{" "}
              <span className="text-x-text-secondary">Followers</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-x-text-secondary">
          {author.website && (
            <a
              href={author.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-x-blue hover:underline"
            >
              {author.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {author.createdAt && (
            <span>Joined {formatJoinDate(author.createdAt)}</span>
          )}
        </div>

        <a
          href={authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-full bg-x-text px-4 py-1.5 text-sm font-semibold text-x-bg hover:opacity-90"
        >
          View on X
        </a>
      </div>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg
      viewBox="0 0 22 22"
      className="size-5 shrink-0 text-x-blue"
      fill="currentColor"
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.538.354 1.167.551 1.813.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

interface AffiliateBadgeProps {
  affiliate: NonNullable<Bookmark["author"]["affiliate"]>;
}

function AffiliateBadge({ affiliate }: AffiliateBadgeProps) {
  const content = (
    <span className="inline-flex items-center gap-1 text-sm text-x-text-secondary">
      {affiliate.badgeUrl && (
        <img
          src={affiliate.badgeUrl}
          alt=""
          className="size-4 rounded-full"
          loading="lazy"
        />
      )}
      <span className="truncate">{affiliate.name}</span>
    </span>
  );

  if (affiliate.url) {
    return (
      <a
        href={affiliate.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex hover:underline"
      >
        {content}
      </a>
    );
  }
  return content;
}

interface Props {
  author: Bookmark["author"];
  displayKind: TweetKind;
  readingMinutes?: number | null;
}

export function TweetHeader({ author, displayKind, readingMinutes }: Props) {
  const authorUrl = `https://x.com/${author.screenName}`;
  const [cardOpen, setCardOpen] = useState(false);
  const [cardClosing, setCardClosing] = useState(false);

  const handleClose = useCallback(() => {
    setCardClosing(true);
    setTimeout(() => {
      setCardOpen(false);
      setCardClosing(false);
    }, 150);
  }, []);

  const toggleCard = useCallback(() => {
    if (cardOpen) {
      handleClose();
    } else {
      setCardOpen(true);
    }
  }, [cardOpen, handleClose]);

  return (
    <>
      <div className="mb-5 flex items-start gap-3">
        <button
          type="button"
          onClick={toggleCard}
          className="shrink-0 cursor-pointer"
          title={`View ${author.name}'s profile`}
        >
          <img
            src={author.profileImageUrl}
            alt=""
            className="size-12 rounded-full transition-opacity hover:opacity-80"
            loading="lazy"
          />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <a
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-bold text-x-text hover:underline"
            >
              {author.name}
            </a>
            {author.verified && <VerifiedBadge />}
            {author.affiliate && (
              <AffiliateBadge affiliate={author.affiliate} />
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-x-text-secondary">
            <a
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              @{author.screenName}
            </a>
            {author.followersCount != null && (
              <>
                <span>&middot;</span>
                <span>
                  {formatCompactNumber(author.followersCount)} followers
                </span>
              </>
            )}
          </div>
          {author.bio && (
            <p className="mt-0.5 line-clamp-1 text-sm text-x-text-secondary">
              {author.bio}
            </p>
          )}
        </div>
        {readingMinutes != null && (
          <span className="ml-auto shrink-0 text-sm text-x-text-secondary">
            {readingMinutes} min read
          </span>
        )}
      </div>

      {cardOpen && (
        <AuthorCard
          author={author}
          closing={cardClosing}
          onClose={handleClose}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TweetKindPill kind={displayKind} />
      </div>
    </>
  );
}
