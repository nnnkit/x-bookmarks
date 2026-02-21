import { useCallback, useEffect, useRef, useState } from "react";

export interface SelectionRange {
  sectionId: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
}

export interface SelectionToolbarState {
  ranges: SelectionRange[];
  position: { x: number; y: number };
}

function getTextOffsetInSection(section: Element, node: Node, offset: number): number {
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  let charCount = 0;

  while (walker.nextNode()) {
    if (walker.currentNode === node) {
      return charCount + offset;
    }
    charCount += (walker.currentNode.textContent?.length || 0);
  }

  return charCount + offset;
}

function findSectionForNode(node: Node): Element | null {
  let el: Node | null = node;
  while (el) {
    if (el instanceof Element && el.id && el.id.startsWith("section-")) {
      return el;
    }
    el = el.parentNode;
  }
  return null;
}

function isInsideHighlight(node: Node): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof Element && el.tagName === "MARK" && el.classList.contains("xbt-highlight")) {
      return true;
    }
    el = el.parentNode;
  }
  return false;
}

function serializeSelection(selection: Selection, containerRef: React.RefObject<HTMLElement | null>): SelectionRange[] {
  const container = containerRef.current;
  if (!container || selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return [];

  const sectionMap = new Map<string, { section: Element; startOffset: number; endOffset: number; text: string }>();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;

    if (!range.intersectsNode(textNode)) continue;

    const section = findSectionForNode(textNode);
    if (!section) continue;

    const isStartNode = textNode === range.startContainer;
    const isEndNode = textNode === range.endContainer;

    const startInNode = isStartNode ? range.startOffset : 0;
    const endInNode = isEndNode ? range.endOffset : (textNode.textContent?.length || 0);

    if (startInNode === endInNode) continue;

    const sectionId = section.id;
    const startOffset = getTextOffsetInSection(section, textNode, startInNode);
    const endOffset = getTextOffsetInSection(section, textNode, endInNode);
    const text = (textNode.textContent || "").slice(startInNode, endInNode);

    const existing = sectionMap.get(sectionId);
    if (existing) {
      existing.startOffset = Math.min(existing.startOffset, startOffset);
      existing.endOffset = Math.max(existing.endOffset, endOffset);
      existing.text += text;
    } else {
      sectionMap.set(sectionId, { section, startOffset, endOffset, text });
    }
  }

  const results: SelectionRange[] = [];
  for (const [sectionId, data] of sectionMap) {
    results.push({
      sectionId,
      startOffset: data.startOffset,
      endOffset: data.endOffset,
      selectedText: data.text,
    });
  }

  return results;
}

export function useSelectionToolbar(containerRef: React.RefObject<HTMLElement | null>) {
  const [toolbarState, setToolbarState] = useState<SelectionToolbarState | null>(null);
  const dismissTimeoutRef = useRef<number>(0);

  const dismiss = useCallback(() => {
    setToolbarState(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    clearTimeout(dismissTimeoutRef.current);

    dismissTimeoutRef.current = window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setToolbarState(null);
        return;
      }

      if (isInsideHighlight(selection.anchorNode!)) {
        setToolbarState(null);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setToolbarState(null);
        return;
      }

      const ranges = serializeSelection(selection, containerRef);
      if (ranges.length === 0) {
        setToolbarState(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      setToolbarState({
        ranges,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
      });
    }, 10);
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      clearTimeout(dismissTimeoutRef.current);
    };
  }, [handleMouseUp]);

  useEffect(() => {
    const handleScroll = () => dismiss();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss]);

  return { toolbarState, dismiss };
}
