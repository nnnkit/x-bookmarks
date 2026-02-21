import { useEffect, useRef, useState } from "react";
import type { Highlight } from "../../types";

interface Props {
  highlight: Highlight;
  position: { x: number; y: number };
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, note: string | null) => void;
  onDismiss: () => void;
}

export function HighlightPopover({ highlight, position, onDelete, onUpdateNote, onDismiss }: Props) {
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState(highlight.note || "");
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(noteText.length, noteText.length);
    }
  }, [editing]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  const handleSaveNote = () => {
    const trimmed = noteText.trim();
    onUpdateNote(highlight.id, trimmed || null);
    setEditing(false);
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveNote();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      setEditing(false);
      setNoteText(highlight.note || "");
    }
  };

  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y + 4,
    transform: "translateX(-50%)",
    zIndex: 30,
  };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="w-64 rounded-lg border border-x-border bg-x-card shadow-xl"
    >
      {highlight.note && !editing && (
        <div className="border-b border-x-border px-3 py-2.5">
          <p className="whitespace-pre-wrap text-sm text-x-text text-pretty">{highlight.note}</p>
        </div>
      )}

      {editing && (
        <div className="border-b border-x-border p-2">
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Add a note..."
            rows={3}
            className="w-full resize-none rounded-md border border-x-border bg-transparent px-2.5 py-2 text-sm text-x-text placeholder:text-x-text-secondary/50 focus:border-amber-500 focus:outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              onClick={() => { setEditing(false); setNoteText(highlight.note || ""); }}
              className="rounded-md px-2.5 py-1 text-xs text-x-text-secondary transition-colors hover:bg-x-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-2 text-left text-sm text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
          >
            <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
              <path d="M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z" />
            </svg>
            {highlight.note ? "Edit note" : "Add note"}
          </button>
        )}

        <button
          onClick={() => { onDelete(highlight.id); onDismiss(); }}
          className="flex items-center gap-2 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
        >
          <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
            <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
          </svg>
          Delete highlight
        </button>
      </div>
    </div>
  );
}
