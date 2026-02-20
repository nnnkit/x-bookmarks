# Codebase Checkup

Production-readiness review of every folder and file.

---

## Summary of changes made

### Dead code removed
- **`src/api/messages.ts`** — Redundant barrel file re-exporting from `api/core/auth` and `api/core/bookmarks`. Never imported anywhere. All consumers use `api/core` or direct module imports. Deleted.
- **`src/components/reader/TweetMetrics.tsx`** — Full component never imported or rendered anywhere. Deleted.
- **`src/components/reader/TableOfContents.tsx`** — Component + two hooks (`useActiveSection`, `useScrolledPast`) never imported outside their own file. Deleted.
- **`src/lib/format.ts`** — Single `formatNumber` function only consumed by the deleted `TweetMetrics`. Deleted.
- **`src/lib/json.ts`** → Removed unused `asStringOrEmpty` function (only defined, never imported).
- **`src/components/reader/utils.ts`** → Removed dead `formatNumber` re-export (only consumer was deleted TweetMetrics).

### Duplicate code consolidated
- **`src/components/BookmarksList.tsx`** — Had local copies of `toSingleLine`, `pickTitle`, `estimateReadingMinutes` that were identical to `src/lib/bookmark-utils.ts`. Removed duplicates and imported from the shared module. Replaced local `formatTimeAgo` with `timeAgo` from `src/lib/time.ts`.
- **`src/lib/time.ts`** → `timeAgo` was defined but never imported. Updated it to match the `formatTimeAgo` behavior needed by BookmarksList (adds "ago" suffix, handles edge cases).
- **`src/hooks/useWallpaper.ts`** + **`src/lib/gradient.ts`** — Both had identical `simpleHash` functions. Exported from `gradient.ts`, imported in `useWallpaper.ts`.

### Hardcoded font sizes replaced with Tailwind tokens
- **`src/components/BookmarksList.tsx`** — `text-[10px]` → `text-xs`
- **`src/components/reader/TweetHeader.tsx`** — `text-[11px]` → `text-xs`
- **`src/components/reader/TweetRecommendations.tsx`** — `text-[11px]` → `text-xs`
- **`src/components/reader/utils.ts`** — `text-[0.99rem]` → `text-base`, `leading-[1.75]` → `leading-relaxed`

### Trailing whitespace / blank lines
- **`src/lib/bookmark-utils.ts`** — Removed trailing blank line.
- **`src/lib/time.ts`** — Removed trailing blank line.

### Excessive documentation removed
- **`changes.md`** — Outdated "Production Readiness Audit" doc referencing non-existent files. Deleted.
- **`IMPLEMENTATION_DETAILS.md`** — ~1700 lines about how twillot (a different project) works. Not relevant to this codebase. Deleted.
- **`LINE_BY_LINE_EXPLAINED.md`** — ~930 lines explaining techniques from a different extension. Deleted.
- **`STORAGE_EXPLAINED.md`** — Explains storage of another project, not this one. Deleted.

### Service worker dev tooling removed
- **`public/service-worker.js`** — Removed ~110 lines of developer-only GraphQL documentation export tooling:
  - `formatDateTime()`, `escapeMarkdown()`, `markdownForParam()` — markdown formatting helpers
  - `buildGraphqlDocsMarkdown()` — generates markdown documentation from captured catalog
  - `handleGetGraphqlCatalog()` — returns raw catalog data
  - `handleExportGraphqlDocs()` — generates exportable docs
  - Removed message handlers for `GET_GRAPHQL_CATALOG` and `EXPORT_GRAPHQL_DOCS`
  - Kept runtime catalog capture functions (`loadGraphqlCatalog`, `captureGraphqlEndpoint`, etc.) since they serve the auto-adaptation to X API changes.

### ARCHITECTURE.md updated
- Fixed outdated file paths: `src/background/service-worker.ts` → `public/service-worker.js`, `src/content/detect-user.ts` → `public/content/detect-user.js`
- Replaced entire File Structure section with accurate tree reflecting current codebase (api/core/, components/reader/, components/popup/, popup entry, etc.)
- Removed references to non-existent files: `BookmarkCard.tsx`, `SyncProgress.tsx`, `twitter.ts`, `features.ts`

---

## Observations (no code changes, noted for awareness)

### Architecture
- **`src/api/core/bookmarks.ts`** and **`src/api/core/posts.ts`** both define a local `RuntimeResponse` interface and `runtimeError` helper. These are intentionally kept separate — the error fallback strings differ (`"API_ERROR"` vs `"DETAIL_ERROR"`), and the duplication is minimal (3 lines each). Extracting them would add coupling for negligible gain.
- **`src/lib/cn.ts`** wraps `clsx` in a single function. This is a common pattern (e.g., shadcn/ui) that allows future extension (e.g., adding `tailwind-merge`). Kept as-is.

### Styling
- **`src/PopupApp.tsx`** uses inline `style={{ height: 200 }}` and `style={{ maxHeight: 500 }}`. These are for the Chrome extension popup which needs explicit pixel constraints. Tailwind's `h-` scale doesn't map cleanly to popup sizing requirements.
- **`src/components/popup/PopupBookmarkList.tsx`** uses `style={{ maxHeight: 400 }}` for the same reason.

### Documentation
- **Kept**: `CHANGELOG.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `RELEASING.md`, `soul.md` (product direction)
- **Missing**: A `README.md` with project description, install instructions, and screenshots
