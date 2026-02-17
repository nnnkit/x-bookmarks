import { useEffect } from "react";
import type { Bookmark } from "../types";

export function useKeyboardNavigation(opts: {
  selectedBookmark: Bookmark | null;
  filteredBookmarks: Bookmark[];
  focusedIndex: number;
  setFocusedIndex: (fn: (prev: number) => number) => void;
  openBookmark: (b: Bookmark) => void;
  closeReader: () => void;
  setSelectedBookmark: (b: Bookmark) => void;
}): void {
  const {
    selectedBookmark,
    filteredBookmarks,
    focusedIndex,
    setFocusedIndex,
    openBookmark,
    closeReader,
    setSelectedBookmark,
  } = opts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA";

      // Reader view shortcuts
      if (selectedBookmark) {
        if (e.key === "Escape") {
          closeReader();
          return;
        }
        // Navigate between bookmarks in reader
        if (e.key === "j" || e.key === "ArrowRight") {
          const idx = filteredBookmarks.findIndex(
            (b) => b.id === selectedBookmark.id,
          );
          if (idx < filteredBookmarks.length - 1) {
            setSelectedBookmark(filteredBookmarks[idx + 1]);
          }
          return;
        }
        if (e.key === "k" || e.key === "ArrowLeft") {
          const idx = filteredBookmarks.findIndex(
            (b) => b.id === selectedBookmark.id,
          );
          if (idx > 0) {
            setSelectedBookmark(filteredBookmarks[idx - 1]);
          }
          return;
        }
        return;
      }

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
        return;
      }

      if (e.key === "Escape") {
        (document.activeElement as HTMLElement)?.blur();
        setFocusedIndex(() => -1);
        return;
      }

      if (isInput) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredBookmarks.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (
        (e.key === "Enter" || e.key === "o") &&
        focusedIndex >= 0
      ) {
        openBookmark(filteredBookmarks[focusedIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedBookmark,
    filteredBookmarks,
    focusedIndex,
    openBookmark,
    closeReader,
    setSelectedBookmark,
    setFocusedIndex,
  ]);
}
