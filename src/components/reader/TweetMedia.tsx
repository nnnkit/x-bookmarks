import { useCallback, useEffect, useState } from "react";
import type { Media } from "../../types";
import { cn } from "../../lib/cn";

function mediaHeightClass(total: number, index: number): string {
  if (total === 1) return "max-h-[72vh]";
  if (total === 3 && index === 0) return "h-60";
  return "h-44";
}

interface ImagePreviewProps {
  src: string;
  alt: string;
  onClose: () => void;
}

function ImagePreview({ src, alt, onClose }: ImagePreviewProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

interface Props {
  items: Media[];
  bleed?: boolean;
}

export function TweetMedia({ items, bleed = false }: Props) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  const closePreview = useCallback(() => setPreviewImage(null), []);

  if (items.length === 0) return null;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const columns = items.length === 1 ? "grid-cols-1" : "grid-cols-2";
  const visible = items.slice(0, 4);

  return (
    <>
      <div className={cn("mt-5 overflow-hidden rounded-2xl border border-x-border bg-x-border", bleed && "-mx-6")}>
        <div className={cn("grid gap-px", columns)}>
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
                  autoPlay={item.type === "animated_gif" && !prefersReducedMotion}
                  muted={item.type === "animated_gif"}
                  playsInline
                  className={cn("w-full bg-black object-contain", heightClass)}
                  poster={item.url}
                />
              ) : (
                <img
                  key={`${item.url}-${index}`}
                  src={item.url}
                  alt={item.altText || ""}
                  className={cn("w-full cursor-pointer bg-black object-contain", heightClass, spanClass)}
                  loading="lazy"
                  onClick={() => setPreviewImage({ src: item.url, alt: item.altText || "" })}
                />
              );
            }

            return (
              <img
                key={`${item.url}-${index}`}
                src={item.url}
                alt={item.altText || ""}
                className={cn("w-full cursor-pointer object-cover", heightClass, spanClass)}
                loading="lazy"
                onClick={() => setPreviewImage({ src: item.url, alt: item.altText || "" })}
              />
            );
          })}
        </div>
      </div>

      {previewImage && (
        <ImagePreview
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={closePreview}
        />
      )}
    </>
  );
}
