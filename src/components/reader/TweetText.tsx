import { useMemo } from "react";
import { paragraphizeText, paragraphHtml, textClassForMode } from "./utils";

interface Props {
  text: string;
  compact?: boolean;
  style?: "tweet" | "article";
  sectionIdPrefix?: string;
}

export function RichTextBlock({ text, compact = false, style = "tweet", sectionIdPrefix }: Props) {
  const paragraphs = useMemo(
    () => paragraphizeText(text, style),
    [text, style],
  );
  const textClass = textClassForMode(compact);

  if (paragraphs.length === 0) return null;

  const spacingClass = compact ? "space-y-3" : style === "article" ? "space-y-6" : "space-y-5";

  return (
    <div className={spacingClass}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${index}-${paragraph.slice(0, 24)}`}
          id={sectionIdPrefix ? `${sectionIdPrefix}-${index}` : undefined}
          className={textClass}
          dangerouslySetInnerHTML={{ __html: paragraphHtml(paragraph) }}
        />
      ))}
    </div>
  );
}
