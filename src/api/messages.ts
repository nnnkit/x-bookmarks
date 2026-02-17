import { asRecord, asString, toNumber } from "../lib/json";

export interface GraphQLEndpointCatalogEntry {
  key: string;
  operation: string;
  queryId: string;
  path: string;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  methods: string[];
  sampleUrl: string;
  sampleVariables: string | null;
  sampleFeatures: string | null;
  sampleFieldToggles: string | null;
}

export interface GraphQLEndpointCatalog {
  generatedAt: number;
  updatedAt: number;
  endpoints: GraphQLEndpointCatalogEntry[];
}

export interface GraphQLDocsExport {
  markdown: string;
  fileName: string;
  generatedAt: number;
}

export type BookmarkChangeType = "CreateBookmark" | "DeleteBookmark";

export interface BookmarkChangeEvent {
  id: string;
  type: BookmarkChangeType;
  tweetId: string;
  at: number;
  source: string;
}

export async function checkAuth() {
  return chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
}

export async function startAuthCapture() {
  return chrome.runtime.sendMessage({ type: "START_AUTH_CAPTURE" });
}

export async function closeAuthTab() {
  await chrome.runtime.sendMessage({ type: "CLOSE_AUTH_TAB" });
}

export async function checkReauthStatus() {
  return chrome.runtime.sendMessage({ type: "REAUTH_STATUS" });
}

export async function fetchGraphqlCatalog(): Promise<GraphQLEndpointCatalog> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_GRAPHQL_CATALOG",
  });
  if (response?.error) throw new Error(response.error);

  const data = response?.data;
  const endpoints = Array.isArray(data?.endpoints) ? data.endpoints : [];

  return {
    generatedAt: Number(data?.generatedAt || Date.now()),
    updatedAt: Number(data?.updatedAt || 0),
    endpoints: endpoints as GraphQLEndpointCatalogEntry[],
  };
}

export async function exportGraphqlDocs(): Promise<GraphQLDocsExport> {
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_GRAPHQL_DOCS",
  });
  if (response?.error) throw new Error(response.error);

  const data = response?.data;
  const markdown = typeof data?.markdown === "string" ? data.markdown : "";
  const fileName =
    typeof data?.fileName === "string"
      ? data.fileName
      : "x-graphql-api-docs.md";

  return {
    markdown,
    fileName,
    generatedAt: Number(data?.generatedAt || Date.now()),
  };
}

export async function deleteBookmark(tweetId: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "DELETE_BOOKMARK",
    tweetId,
  });
  if (response?.error) throw new Error(response.error);
}

function normalizeBookmarkChangeEvents(value: unknown): BookmarkChangeEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      const type = asString(record?.type);
      const tweetId = asString(record?.tweetId);
      if (type !== "CreateBookmark" && type !== "DeleteBookmark") return null;
      const at = toNumber(record?.at);
      const source = asString(record?.source) || "unknown";
      const id =
        asString(record?.id) ||
        `${type}-${at || Date.now()}-${tweetId || "unknown"}-${index}`;
      return {
        id,
        type,
        tweetId: tweetId || "",
        at,
        source,
      };
    })
    .filter((event): event is BookmarkChangeEvent => event !== null);
}

export async function getBookmarkEvents(): Promise<BookmarkChangeEvent[]> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_BOOKMARK_EVENTS",
  });
  if (response?.error) throw new Error(response.error);
  return normalizeBookmarkChangeEvents(response?.data?.events);
}

export async function ackBookmarkEvents(ids: string[]): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "ACK_BOOKMARK_EVENTS",
    ids,
  });
  if (response?.error) throw new Error(response.error);
}

export async function drainBookmarkEvents(): Promise<BookmarkChangeEvent[]> {
  const response = await chrome.runtime.sendMessage({
    type: "DRAIN_BOOKMARK_EVENTS",
  });
  if (response?.error) throw new Error(response.error);

  return normalizeBookmarkChangeEvents(response?.data?.events);
}
