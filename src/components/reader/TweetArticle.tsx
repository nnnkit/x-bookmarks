import { useMemo } from "react";
import type {
  Bookmark,
  ArticleContentBlock,
  ArticleContentEntity,
} from "../../types";
import {
  baseTweetTextClass,
  detectArticleHeadings,
  groupBlocks,
  renderBlockInlineContent,
} from "./utils";
import { RichTextBlock } from "./TweetText";

function ArticleBlockRenderer({
  blocks,
  entityMap,
}: {
  blocks: ArticleContentBlock[];
  entityMap: Record<string, ArticleContentEntity>;
}) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const serifFont = `font-[Charter,"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif]`;
  const bodyClass = `${baseTweetTextClass} text-x-text text-pretty ${serifFont} text-[1.04rem] leading-8`;

  return (
    <div className="space-y-4">
      {groups.map((group, groupIdx) => {
        if (group.type === "unordered-list") {
          return (
            <ul
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className={`list-disc pl-6 space-y-1.5 ${bodyClass}`}
            >
              {group.items.map((item, i) => (
                <li
                  key={`li-${groupIdx}-${i}`}
                  dangerouslySetInnerHTML={{
                    __html: renderBlockInlineContent(item, entityMap),
                  }}
                />
              ))}
            </ul>
          );
        }

        if (group.type === "ordered-list") {
          return (
            <ol
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className={`list-decimal pl-6 space-y-1.5 ${bodyClass}`}
            >
              {group.items.map((item, i) => (
                <li
                  key={`li-${groupIdx}-${i}`}
                  dangerouslySetInnerHTML={{
                    __html: renderBlockInlineContent(item, entityMap),
                  }}
                />
              ))}
            </ol>
          );
        }

        const { block } = group;
        const html = renderBlockInlineContent(block, entityMap);

        if (block.type === "atomic") {
          for (const range of block.entityRanges) {
            const entity = entityMap[String(range.key)];
            if (entity?.type === "MEDIA") {
              const imageUrl = entity.data?.imageUrl;
              if (typeof imageUrl === "string" && imageUrl) {
                return (
                  <figure
                    key={`group-${groupIdx}`}
                    className="my-6 break-inside-avoid"
                  >
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  </figure>
                );
              }
            }
            if (entity?.type === "MARKDOWN") {
              const markdown = String(entity.data?.markdown || "");
              if (markdown) {
                const code = markdown
                  .replace(/^```\w*\n?/, "")
                  .replace(/\n?```$/, "");
                return (
                  <pre
                    key={`group-${groupIdx}`}
                    className="my-4 overflow-x-auto rounded-lg bg-x-card p-4 text-sm leading-relaxed text-x-text font-mono break-inside-avoid"
                  >
                    <code>{code}</code>
                  </pre>
                );
              }
            }
            if (entity?.type === "DIVIDER") {
              return (
                <hr
                  key={`group-${groupIdx}`}
                  className="my-6 border-x-border"
                />
              );
            }
          }
          return null;
        }

        if (!block.text.trim()) {
          return <div key={`group-${groupIdx}`} className="h-2" />;
        }

        if (block.type === "header-one") {
          return (
            <h2
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className={`scroll-mt-24 text-2xl font-bold tracking-tight text-balance text-x-text ${serifFont} mt-6 mb-2 break-inside-avoid break-after-avoid`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "header-two") {
          return (
            <h3
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className={`scroll-mt-24 text-xl font-bold tracking-tight text-balance text-x-text ${serifFont} mt-5 mb-2 break-inside-avoid break-after-avoid`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "header-three") {
          return (
            <h4
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className={`scroll-mt-24 text-lg font-bold text-balance text-x-text ${serifFont} mt-4 mb-1 break-inside-avoid break-after-avoid`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className={`border-l-3 border-x-text-secondary/40 pl-4 italic ${bodyClass} break-inside-avoid`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "code-block") {
          return (
            <pre
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className="overflow-x-auto rounded-lg bg-x-card p-4 text-sm leading-relaxed text-x-text font-mono break-inside-avoid"
            >
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          );
        }

        return (
          <p
            key={`group-${groupIdx}`}
            id={`section-block-${groupIdx}`}
            className={bodyClass}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}

export function TweetArticle({
  article,
  compact = false,
}: {
  article: NonNullable<Bookmark["article"]>;
  compact?: boolean;
}) {
  const plainText = article.plainText?.trim() || "";
  const hasBlocks =
    article.contentBlocks !== undefined && article.contentBlocks.length > 0;
  const headings = useMemo(
    () => (hasBlocks ? [] : detectArticleHeadings(plainText)),
    [plainText, hasBlocks],
  );

  const titleClass =
    "reader-heading text-lg font-semibold text-balance text-x-text";

  if (hasBlocks) {
    return (
      <section>
        {article.coverImageUrl && (
          <img
            src={article.coverImageUrl}
            alt=""
            className="mb-5 w-full rounded-xl object-cover break-inside-avoid"
            loading="lazy"
          />
        )}
        {article.title && (
          <h3
            id="section-article-title"
            className={`${titleClass} mb-5 break-inside-avoid`}
          >
            {article.title}
          </h3>
        )}
        <div>
          <ArticleBlockRenderer
            blocks={article.contentBlocks!}
            entityMap={article.entityMap || {}}
          />
        </div>
      </section>
    );
  }

  if (headings.length === 0) {
    return (
      <section>
        {article.coverImageUrl && (
          <img
            src={article.coverImageUrl}
            alt=""
            className="mb-5 w-full rounded-xl object-cover"
            loading="lazy"
          />
        )}
        {article.title && (
          <h3 id="section-article-title" className={titleClass}>
            {article.title}
          </h3>
        )}
        <div className="mt-2 md:columns-2 md:gap-8">
          <RichTextBlock text={plainText} compact={compact} style="article" />
        </div>
      </section>
    );
  }

  const lines = plainText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headingLineIndices = new Set(headings.map((h) => h.index));

  const chunks: { heading?: string; headingIdx: number; text: string }[] = [];
  let currentLines: string[] = [];
  let currentHeading: string | undefined;
  let currentHeadingIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (headingLineIndices.has(i)) {
      if (currentLines.length > 0 || currentHeading !== undefined) {
        chunks.push({
          heading: currentHeading,
          headingIdx: currentHeadingIdx,
          text: currentLines.join("\n"),
        });
      }
      const hIdx = headings.findIndex((h) => h.index === i);
      currentHeading = headings[hIdx].text;
      currentHeadingIdx = hIdx;
      currentLines = [];
    } else {
      currentLines.push(lines[i]);
    }
  }
  if (currentLines.length > 0 || currentHeading !== undefined) {
    chunks.push({
      heading: currentHeading,
      headingIdx: currentHeadingIdx,
      text: currentLines.join("\n"),
    });
  }

  const headingClass =
    "reader-heading text-base font-semibold mt-6 mb-2 text-x-text break-inside-avoid break-after-avoid";

  return (
    <section>
      {article.coverImageUrl && (
        <img
          src={article.coverImageUrl}
          alt=""
          className="mb-5 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}
      {article.title && (
        <h3 id="section-article-title" className={titleClass}>
          {article.title}
        </h3>
      )}
      <div className="md:columns-2 md:gap-8">
        {chunks.map((chunk, i) => (
          <div key={`chunk-${i}`}>
            {chunk.heading && (
              <h4
                id={`section-article-${chunk.headingIdx}`}
                className={headingClass}
              >
                {chunk.heading}
              </h4>
            )}
            {chunk.text && (
              <div className={chunk.heading ? "" : "mt-2"}>
                <RichTextBlock
                  text={chunk.text}
                  compact={compact}
                  style="article"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
