import { useMemo } from "react";
import type {
  Bookmark,
  ArticleContentBlock,
  ArticleContentEntity,
} from "../../types";
import {
  detectArticleHeadings,
  groupBlocks,
  renderBlockInlineContent,
} from "./utils";
import { RichTextBlock } from "./TweetText";
import { CodeBlock } from "./CodeBlock";

function isLikelyProfileAvatarUrl(value: string): boolean {
  return /\/profile_images\//i.test(value);
}

function normalizeAvatarCandidateUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutHash = trimmed.split("#")[0];
  const [withoutQuery] = withoutHash.split("?");

  return withoutQuery
    .replace(/_(normal|bigger|mini)(?=\.[a-z0-9]+$)/i, "")
    .toLowerCase();
}

interface ArticleBlockRendererProps {
  blocks: ArticleContentBlock[];
  entityMap: Record<string, ArticleContentEntity>;
}

function ArticleBlockRenderer({ blocks, entityMap }: ArticleBlockRendererProps) {
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);

  return (
    <div className="prose prose-lg prose-reader max-w-none font-[Charter,'Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] [&_a]:text-x-blue [&_a:hover]:underline">
      {groups.map((group, groupIdx) => {
        if (group.type === "unordered-list") {
          return (
            <ul key={`group-${groupIdx}`} id={`section-block-${groupIdx}`}>
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
            <ol key={`group-${groupIdx}`} id={`section-block-${groupIdx}`}>
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
                    className="-mx-6 my-6 break-inside-avoid"
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
                  <CodeBlock
                    key={`group-${groupIdx}`}
                    code={code}
                  />
                );
              }
            }
            if (entity?.type === "DIVIDER") {
              return <hr key={`group-${groupIdx}`} />;
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
              className="scroll-mt-24 break-inside-avoid break-after-avoid"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "header-two") {
          return (
            <h3
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className="scroll-mt-24 break-inside-avoid break-after-avoid"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "header-three") {
          return (
            <h4
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className="scroll-mt-24 break-inside-avoid break-after-avoid"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={`group-${groupIdx}`}
              id={`section-block-${groupIdx}`}
              className="break-inside-avoid"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (block.type === "code-block") {
          return (
            <CodeBlock
              key={`group-${groupIdx}`}
              code={block.text}
            />
          );
        }

        return (
          <p
            key={`group-${groupIdx}`}
            id={`section-block-${groupIdx}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}

interface Props {
  article: NonNullable<Bookmark["article"]>;
  compact?: boolean;
  authorProfileImageUrl?: string;
}

export function TweetArticle({ article, compact = false, authorProfileImageUrl }: Props) {
  const plainText = article.plainText?.trim() || "";
  const coverImageUrl = useMemo(() => {
    const cover = article.coverImageUrl?.trim() || "";
    if (!cover) return "";
    if (isLikelyProfileAvatarUrl(cover)) return "";

    const authorAvatar = authorProfileImageUrl?.trim() || "";
    if (!authorAvatar) return cover;

    const normalizedCover = normalizeAvatarCandidateUrl(cover);
    const normalizedAvatar = normalizeAvatarCandidateUrl(authorAvatar);
    if (normalizedCover && normalizedCover === normalizedAvatar) {
      return "";
    }

    return cover;
  }, [article.coverImageUrl, authorProfileImageUrl]);

  const hasBlocks =
    article.contentBlocks !== undefined && article.contentBlocks.length > 0;
  const headings = useMemo(
    () => (hasBlocks ? [] : detectArticleHeadings(plainText)),
    [plainText, hasBlocks],
  );

  const serifFont = `font-[Charter,"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif]`;
  const titleClass =
    `reader-heading text-3xl font-bold tracking-tight text-balance text-x-text ${serifFont}`;

  if (hasBlocks) {
    return (
      <section>
        {coverImageUrl && !compact && (
          <div className="-mx-6 mb-5">
            <img
              src={coverImageUrl}
              alt=""
              className="w-full object-cover break-inside-avoid"
              loading="lazy"
            />
          </div>
        )}
        {coverImageUrl && compact && (
          <img
            src={coverImageUrl}
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
        <ArticleBlockRenderer
          blocks={article.contentBlocks!}
          entityMap={article.entityMap || {}}
        />
      </section>
    );
  }

  if (headings.length === 0) {
    return (
      <section>
        {coverImageUrl && !compact && (
          <div className="-mx-6 mb-5">
            <img
              src={coverImageUrl}
              alt=""
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        {coverImageUrl && compact && (
          <img
            src={coverImageUrl}
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
      {coverImageUrl && !compact && (
        <div className="-mx-6 mb-5">
          <img
            src={coverImageUrl}
            alt=""
            className="w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      {coverImageUrl && compact && (
        <img
          src={coverImageUrl}
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
