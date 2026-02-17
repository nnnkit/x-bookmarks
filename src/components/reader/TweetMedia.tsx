import type { Media } from "../../types";

function mediaHeightClass(total: number, index: number): string {
  if (total === 1) return "max-h-[72vh]";
  if (total === 3 && index === 0) return "h-60";
  return "h-44";
}

export function TweetMedia({ items }: { items: Media[] }) {
  if (items.length === 0) return null;

  const columns = items.length === 1 ? "grid-cols-1" : "grid-cols-2";
  const visible = items.slice(0, 4);

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-x-border bg-x-border">
      <div className={`grid ${columns} gap-px`}>
        {visible.map((item, index) => {
          const heightClass = mediaHeightClass(visible.length, index);
          const spanClass = visible.length === 3 && index === 0 ? "col-span-2" : "";

          if (item.type === "video" || item.type === "animated_gif") {
            return item.videoUrl ? (
              <video
                key={`${item.url}-${index}`}
                src={item.videoUrl}
                controls
                loop={item.type === "animated_gif"}
                autoPlay={item.type === "animated_gif"}
                muted={item.type === "animated_gif"}
                playsInline
                className={`w-full bg-black object-contain ${heightClass}`}
                poster={item.url}
              />
            ) : (
              <img
                key={`${item.url}-${index}`}
                src={item.url}
                alt={item.altText || ""}
                className={`w-full bg-black object-contain ${heightClass} ${spanClass}`}
                loading="lazy"
              />
            );
          }

          return (
            <img
              key={`${item.url}-${index}`}
              src={item.url}
              alt={item.altText || ""}
              className={`w-full object-cover ${heightClass} ${spanClass}`}
              loading="lazy"
            />
          );
        })}
      </div>
    </div>
  );
}
