import { useEffect, useRef, useState } from "react";
import type { SelectionRange } from "../../hooks/useSelectionToolbar";

interface Props {
  position: { x: number; y: number };
  ranges: SelectionRange[];
  onHighlight: (ranges: SelectionRange[], note: string | null) => void;
  onDismiss: () => void;
}

export function SelectionToolbar({ position, ranges, onHighlight, onDismiss }: Props) {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showNote && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showNote]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  const handleHighlight = () => {
    onHighlight(ranges, null);
    onDismiss();
  };

  const handleNoteSubmit = () => {
    const trimmed = noteText.trim();
    onHighlight(ranges, trimmed || null);
    onDismiss();
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNoteSubmit();
    }
    if (e.key === "Escape") {
      if (noteText) {
        setNoteText("");
        setShowNote(false);
      } else {
        onDismiss();
      }
    }
  };

  const toolbarStyle: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y - 8,
    transform: "translate(-50%, -100%)",
    zIndex: 30,
  };

  return (
    <div
      ref={toolbarRef}
      style={toolbarStyle}
      className="animate-in flex flex-col items-center"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-x-border bg-x-card px-1.5 py-1 shadow-lg">
        <button
          onClick={handleHighlight}
          aria-label="Highlight selection"
          className="rounded-md p-1.5 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-amber-500"
        >
          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
            <path d="M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM92.69,208H48V163.31l88-88L180.69,120Z" />
          </svg>
        </button>

        <div className="mx-0.5 h-5 w-px bg-x-border" />

        <button
          onClick={() => setShowNote(true)}
          aria-label="Add note to highlight"
          className="rounded-md p-1.5 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-amber-500"
        >
          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
            <path d="M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z" />
          </svg>
        </button>
      </div>

      {showNote && (
        <div className="mt-1.5 w-64 rounded-lg border border-x-border bg-x-card p-2 shadow-lg">
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Add a note..."
            rows={2}
            className="w-full resize-none rounded-md border border-x-border bg-transparent px-2.5 py-2 text-sm text-x-text placeholder:text-x-text-secondary/50 focus:border-amber-500 focus:outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              onClick={() => { setShowNote(false); setNoteText(""); }}
              className="rounded-md px-2.5 py-1 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleNoteSubmit}
              className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
