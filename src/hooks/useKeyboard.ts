import { useEffect, useRef } from "react";
import type { Bookmark } from "../types";

export function useKeyboardNavigation(opts: {
  selectedBookmark: Bookmark | null;
  filteredBookmarks: Bookmark[];
  closeReader: () => void;
  setSelectedBookmark: (b: Bookmark) => void;
}): void {
  const selectedRef = useRef(opts.selectedBookmark);
  const bookmarksRef = useRef(opts.filteredBookmarks);
  const closeRef = useRef(opts.closeReader);
  const setSelectedRef = useRef(opts.setSelectedBookmark);

  selectedRef.current = opts.selectedBookmark;
  bookmarksRef.current = opts.filteredBookmarks;
  closeRef.current = opts.closeReader;
  setSelectedRef.current = opts.setSelectedBookmark;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const selected = selectedRef.current;
      if (!selected) return;

      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key === "j" || e.key === "ArrowRight") {
        const bookmarks = bookmarksRef.current;
        const idx = bookmarks.findIndex((b) => b.id === selected.id);
        if (idx < bookmarks.length - 1) {
          setSelectedRef.current(bookmarks[idx + 1]);
        }
        return;
      }
      if (e.key === "k" || e.key === "ArrowLeft") {
        const bookmarks = bookmarksRef.current;
        const idx = bookmarks.findIndex((b) => b.id === selected.id);
        if (idx > 0) {
          setSelectedRef.current(bookmarks[idx - 1]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
