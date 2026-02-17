import type { Bookmark, TweetKind } from "../../types";
import { KIND_LABEL } from "./types";
import { kindPillClass } from "./utils";

function TweetKindPill({ kind }: { kind: TweetKind }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${kindPillClass(kind)}`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

export { TweetKindPill };

export function TweetHeader({
  author,
  displayKind,
  isLongText,
}: {
  author: Bookmark["author"];
  displayKind: TweetKind;
  isLongText?: boolean;
}) {
  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <img
          src={author.profileImageUrl}
          alt=""
          className="size-12 rounded-full"
          loading="lazy"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-x-text">
              {author.name}
            </span>
            {author.verified && (
              <svg
                viewBox="0 0 22 22"
                className="size-5 shrink-0 text-x-blue"
                fill="currentColor"
              >
                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.538.354 1.167.551 1.813.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
              </svg>
            )}
          </div>
          <span className="text-sm text-x-text-secondary">
            @{author.screenName}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TweetKindPill kind={displayKind} />
        {isLongText && (
          <span className="rounded-full border border-x-border px-2.5 py-1 text-[11px] text-x-text-secondary">
            Long form
          </span>
        )}
      </div>
    </>
  );
}
