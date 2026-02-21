import { useCallback, useEffect, useRef, useState } from "react";
import type { Highlight } from "../types";
import type { SelectionRange } from "./useSelectionToolbar";
import {
  upsertHighlight,
  deleteHighlight as dbDeleteHighlight,
  getHighlightsByTweetId,
} from "../db";

interface Props {
  tweetId: string;
  contentReady: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}

function getTextNodesInSection(section: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}

function stripHighlightMarks(container: Element) {
  const marks = container.querySelectorAll("mark.xbt-highlight");
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }

  const stars = container.querySelectorAll(".xbt-note-star");
  for (const star of stars) {
    star.remove();
  }

  container.normalize();
}

function wrapTextRange(
  section: Element,
  startOffset: number,
  endOffset: number,
  highlightId: string,
  flash: boolean,
): Element[] {
  const textNodes = getTextNodesInSection(section);
  let charCount = 0;
  const wrappedMarks: Element[] = [];

  for (const textNode of textNodes) {
    const nodeLength = textNode.textContent?.length || 0;
    const nodeStart = charCount;
    const nodeEnd = charCount + nodeLength;

    if (nodeEnd <= startOffset || nodeStart >= endOffset) {
      charCount += nodeLength;
      continue;
    }

    const overlapStart = Math.max(startOffset, nodeStart) - nodeStart;
    const overlapEnd = Math.min(endOffset, nodeEnd) - nodeStart;

    if (overlapStart === overlapEnd) {
      charCount += nodeLength;
      continue;
    }

    const parent = textNode.parentNode;
    if (!parent) {
      charCount += nodeLength;
      continue;
    }

    const beforeText = textNode.textContent!.slice(0, overlapStart);
    const highlightText = textNode.textContent!.slice(overlapStart, overlapEnd);
    const afterText = textNode.textContent!.slice(overlapEnd);

    const mark = document.createElement("mark");
    mark.className = flash ? "xbt-highlight xbt-highlight-new" : "xbt-highlight";
    mark.dataset.highlightId = highlightId;
    mark.textContent = highlightText;

    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), textNode);
    }
    parent.insertBefore(mark, textNode);
    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), textNode);
    }
    parent.removeChild(textNode);

    wrappedMarks.push(mark);
    charCount += nodeLength;
  }

  return wrappedMarks;
}

const STAR_SVG = `<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,91l59.46-5.15,23.21-55.36a16.4,16.4,0,0,1,30.5,0l23.21,55.36L226.92,91a16.46,16.46,0,0,1,7.37,23.85Z"/></svg>`;

function injectNoteStar(lastMark: Element, highlightId: string) {
  const star = document.createElement("span");
  star.className = "xbt-note-star";
  star.dataset.highlightId = highlightId;
  star.setAttribute("role", "button");
  star.setAttribute("aria-label", "View note");

  const svg = new DOMParser().parseFromString(STAR_SVG, "image/svg+xml").documentElement;
  star.appendChild(document.importNode(svg, true));

  const section = lastMark.closest("[id^='section-']");
  if (section) {
    const sectionEl = section as HTMLElement;
    if (!sectionEl.style.position) {
      sectionEl.classList.add("relative");
    }
    const markRect = lastMark.getBoundingClientRect();
    const sectionRect = sectionEl.getBoundingClientRect();
    star.style.top = `${markRect.top - sectionRect.top}px`;
    sectionEl.appendChild(star);
  }
}

export function useHighlights({ tweetId, contentReady, containerRef }: Props) {
  const highlightsRef = useRef<Map<string, Highlight>>(new Map());
  const [revision, setRevision] = useState(0);
  const flashIdsRef = useRef<Set<string>>(new Set());

  const applyHighlightsToDOM = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    stripHighlightMarks(container);

    const highlights = Array.from(highlightsRef.current.values()).sort((a, b) => {
      if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
      return a.startOffset - b.startOffset;
    });

    for (const h of highlights) {
      const section = container.querySelector(`#${CSS.escape(h.sectionId)}`);
      if (!section) continue;

      const sectionText = section.textContent || "";
      const actualText = sectionText.slice(h.startOffset, h.endOffset);
      if (actualText !== h.selectedText) continue;

      const shouldFlash = flashIdsRef.current.has(h.id);
      const marks = wrapTextRange(section, h.startOffset, h.endOffset, h.id, shouldFlash);

      if (shouldFlash) {
        flashIdsRef.current.delete(h.id);
      }

      if (h.note && marks.length > 0) {
        injectNoteStar(marks[marks.length - 1], h.id);
      }
    }
  }, [containerRef]);

  useEffect(() => {
    if (!contentReady || !tweetId) return;

    getHighlightsByTweetId(tweetId).then((stored) => {
      highlightsRef.current.clear();
      for (const h of stored) {
        highlightsRef.current.set(h.id, h);
      }
      applyHighlightsToDOM();
    });
  }, [tweetId, contentReady, applyHighlightsToDOM]);

  useEffect(() => {
    if (revision > 0) {
      applyHighlightsToDOM();
    }
  }, [revision, applyHighlightsToDOM]);

  const addHighlight = useCallback(
    async (ranges: SelectionRange[], note: string | null = null) => {
      const created: Highlight[] = [];

      for (const range of ranges) {
        const highlight: Highlight = {
          id: crypto.randomUUID(),
          tweetId,
          sectionId: range.sectionId,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          selectedText: range.selectedText,
          note,
          createdAt: Date.now(),
        };

        await upsertHighlight(highlight);
        highlightsRef.current.set(highlight.id, highlight);
        flashIdsRef.current.add(highlight.id);
        created.push(highlight);
      }

      window.getSelection()?.removeAllRanges();
      setRevision((r) => r + 1);
      return created;
    },
    [tweetId],
  );

  const removeHighlight = useCallback(async (id: string) => {
    await dbDeleteHighlight(id);
    highlightsRef.current.delete(id);
    setRevision((r) => r + 1);
  }, []);

  const updateHighlightNote = useCallback(
    async (id: string, note: string | null) => {
      const existing = highlightsRef.current.get(id);
      if (!existing) return;

      const updated = { ...existing, note };
      await upsertHighlight(updated);
      highlightsRef.current.set(id, updated);
      setRevision((r) => r + 1);
    },
    [],
  );

  const getHighlight = useCallback((id: string) => {
    return highlightsRef.current.get(id) || null;
  }, []);

  return { addHighlight, removeHighlight, updateHighlightNote, getHighlight };
}
