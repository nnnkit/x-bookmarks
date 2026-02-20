import { useCallback, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import type { Media } from "../../types";
import { cn } from "../../lib/cn";
import { Modal } from "../Modal";

function mediaHeightClass(total: number, index: number): string {
  if (total === 1) return "max-h-[72vh]";
  if (total === 3 && index === 0) return "h-60";
  return "h-44";
}

interface Props {
  items: Media[];
  bleed?: boolean;
}

export function TweetMedia({ items, bleed = false }: Props) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const previewRef = useRef<{ src: string; alt: string } | null>(null);
  if (previewImage) previewRef.current = previewImage;

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

      <Modal open={!!previewImage} onClose={closePreview} className="flex items-center justify-center bg-black/80">
        {(closing) => {
          const img = previewRef.current;
          if (!img) return null;
          return (
            <>
              <button
                onClick={closePreview}
                aria-label="Close preview"
                className={cn(
                  "absolute right-4 top-4 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80",
                  closing ? "animate-overlay-out" : "animate-overlay-in",
                )}
              >
                <X size={20} />
              </button>
              <img
                src={img.src}
                alt={img.alt}
                className={cn(
                  "max-h-[90vh] max-w-[90vw] object-contain",
                  closing ? "animate-preview-out" : "animate-preview-in",
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </>
          );
        }}
      </Modal>
    </>
  );
}
