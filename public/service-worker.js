// ═══════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════

const CAPTURED_HEADERS = new Set([
  "authorization",
  "cookie",
  "x-csrf-token",
  "x-client-uuid",
  "x-client-transaction-id",
  "x-twitter-active-user",
  "x-twitter-auth-type",
  "x-twitter-client-language",
]);

const GRAPHQL_CATALOG_STORAGE_KEY = "tw_graphql_catalog";
const GRAPHQL_CATALOG_VERSION = 1;
const MAX_GRAPHQL_ENDPOINTS = 300;
const MAX_CAPTURED_PARAM_LENGTH = 12000;
const CATALOG_FLUSH_DELAY_MS = 600;
const BOOKMARK_EVENTS_STORAGE_KEY = "tw_bookmark_events";
const MAX_BOOKMARK_EVENTS = 400;
const AUTH_STATE_STORAGE_KEYS = [
  "current_user_id",
  "tw_auth_headers",
  "tw_auth_time",
];
const WEEKLY_SW_CLEANUP_KEY = "tw_weekly_cleanup_at";
const WEEKLY_SW_CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;
const BOOKMARK_EVENT_RETENTION_MS = 1000 * 60 * 60 * 24 * 14;
const GRAPHQL_ENDPOINT_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

const DEFAULT_FEATURES = {
  graphql_timeline_v2_bookmark_timeline: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_uc_gql_enabled: true,
  vibe_api_enabled: true,
  responsive_web_text_conversations_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

const DETAIL_FEATURE_OVERRIDES = {
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  responsive_web_twitter_article_data_v2_enabled: true,
};

const DEFAULT_DETAIL_QUERY_ID = "nBS-WpgA6ZG0CyNHD517JQ";
const FALLBACK_DETAIL_QUERY_IDS = [
  DEFAULT_DETAIL_QUERY_ID,
  "bFUhQzgl9zjo-teD0pAQZw",
  "VwKJcAd7zqlBOitPLUrB8A",
];
const DEFAULT_DELETE_BOOKMARK_QUERY_ID = "Wlmlj2-xzyS1GN3a6cj-mQ";
const FALLBACK_DELETE_BOOKMARK_QUERY_IDS = [
  DEFAULT_DELETE_BOOKMARK_QUERY_ID,
  "ZYKSe-w7KEslx3JhSIk5LA",
];

// ═══════════════════════════════════════════════════════════
// AUTH & COOKIE HELPERS
// ═══════════════════════════════════════════════════════════

// NOTE: parseTwidUserId is intentionally duplicated in detect-user.js.
// Content scripts must be self-contained for injection.
function parseTwidUserId(rawValue) {
  if (typeof rawValue !== "string" || !rawValue) return null;

  const candidates = [rawValue];
  try {
    const decoded = decodeURIComponent(rawValue);
    if (decoded && decoded !== rawValue) {
      candidates.push(decoded);
    }
  } catch {}

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const userMatch = trimmed.match(/u=(\d+)/);
    if (userMatch?.[1]) return userMatch[1];

    const encodedMatch = trimmed.match(/u%3[Dd](\d+)/);
    if (encodedMatch?.[1]) return encodedMatch[1];

    if (/^\d+$/.test(trimmed)) return trimmed;
  }

  return null;
}

async function readUserIdFromTwidCookie() {
  try {
    const twidCookie = await chrome.cookies.get({
      url: "https://x.com",
      name: "twid",
    });
    return parseTwidUserId(twidCookie?.value || "");
  } catch {
    return null;
  }
}

async function clearAuthSessionState() {
  await chrome.storage.local.remove(AUTH_STATE_STORAGE_KEYS);
}

async function syncAuthSessionFromCookie(storedState = null) {
  const userId = await readUserIdFromTwidCookie();
  if (userId) {
    if (storedState?.current_user_id !== userId) {
      await chrome.storage.local.set({ current_user_id: userId });
    }
    return userId;
  }

  const hasStoredAuthState = storedState
    ? Boolean(
        storedState.current_user_id ||
          storedState.tw_auth_headers?.authorization ||
          storedState.tw_auth_time,
      )
    : true;

  if (hasStoredAuthState) {
    await clearAuthSessionState();
  }

  return null;
}

let authTabId = null;
let reauthInProgress = false;

function incrementTransactionId(str) {
  if (!str) return str;
  const digits = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] >= "0" && str[i] <= "9") digits.push(i);
  }
  if (digits.length === 0) return str;
  const idx = digits[Math.floor(Math.random() * digits.length)];
  const bump = Math.floor(Math.random() * 8) + 1;
  const newDigit = ((parseInt(str[idx], 10) + bump) % 10).toString();
  return str.slice(0, idx) + newDigit + str.slice(idx + 1);
}

function reAuthSilently() {
  if (reauthInProgress) return Promise.resolve(false);
  reauthInProgress = true;

  return new Promise((resolve) => {
    let tabId = null;
    let resolved = false;

    const cleanup = () => {
      if (tabId) {
        chrome.tabs.remove(tabId).catch(() => {});
        tabId = null;
      }
      chrome.storage.local.onChanged.removeListener(onChange);
      reauthInProgress = false;
    };

    const onChange = (changes) => {
      if (changes.tw_auth_headers && !resolved) {
        resolved = true;
        cleanup();
        resolve(true);
      }
    };

    chrome.storage.local.onChanged.addListener(onChange);

    chrome.tabs.create({ url: "https://x.com/i/bookmarks", active: false }, (tab) => {
      tabId = tab.id;
      authTabId = tab.id;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(false);
      }
    }, 15000);
  });
}

async function buildHeaders() {
  const stored = await chrome.storage.local.get(["tw_auth_headers"]);
  const auth = stored.tw_auth_headers;
  if (!auth?.authorization) throw new Error("NO_AUTH");

  const headers = {
    authorization: auth["authorization"],
    "x-csrf-token": auth["x-csrf-token"],
    "x-twitter-active-user": auth["x-twitter-active-user"] || "yes",
    "x-twitter-auth-type": auth["x-twitter-auth-type"] || "OAuth2Session",
    "x-twitter-client-language": auth["x-twitter-client-language"] || "en",
    "content-type": "application/json",
  };

  if (auth["cookie"]) headers["cookie"] = auth["cookie"];
  if (auth["x-client-uuid"]) headers["x-client-uuid"] = auth["x-client-uuid"];
  if (auth["x-client-transaction-id"]) {
    headers["x-client-transaction-id"] = incrementTransactionId(
      auth["x-client-transaction-id"]
    );
  }

  return headers;
}

// ═══════════════════════════════════════════════════════════
// GRAPHQL CATALOG
// ═══════════════════════════════════════════════════════════

let graphqlCatalogCache = null;
let graphqlCatalogLoadPromise = null;
let catalogDirty = false;
let catalogFlushTimer = null;

function createEmptyCatalog() {
  return {
    version: GRAPHQL_CATALOG_VERSION,
    updatedAt: 0,
    endpoints: {},
  };
}

function trimCapturedParam(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= MAX_CAPTURED_PARAM_LENGTH) return value;
  const overflow = value.length - MAX_CAPTURED_PARAM_LENGTH;
  return `${value.slice(0, MAX_CAPTURED_PARAM_LENGTH)}... [truncated ${overflow} chars]`;
}

function parseGraphqlEndpoint(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/i\/api\/graphql\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return {
      queryId: decodeURIComponent(match[1]),
      operation: decodeURIComponent(match[2]),
      variables: trimCapturedParam(url.searchParams.get("variables")),
      features: trimCapturedParam(url.searchParams.get("features")),
      fieldToggles: trimCapturedParam(url.searchParams.get("fieldToggles")),
      path: url.pathname,
      fullUrl: url.toString(),
    };
  } catch {
    return null;
  }
}

function enforceCatalogLimit(catalog) {
  const entries = Object.values(catalog.endpoints || {});
  if (entries.length <= MAX_GRAPHQL_ENDPOINTS) return;
  entries
    .sort((a, b) => a.lastSeen - b.lastSeen)
    .slice(0, entries.length - MAX_GRAPHQL_ENDPOINTS)
    .forEach((entry) => {
      delete catalog.endpoints[entry.key];
    });
}

async function loadGraphqlCatalog() {
  if (graphqlCatalogCache) return graphqlCatalogCache;
  if (!graphqlCatalogLoadPromise) {
    graphqlCatalogLoadPromise = chrome.storage.local
      .get([GRAPHQL_CATALOG_STORAGE_KEY])
      .then((stored) => {
        const existing = stored[GRAPHQL_CATALOG_STORAGE_KEY];
        if (
          existing &&
          typeof existing === "object" &&
          !Array.isArray(existing) &&
          typeof existing.endpoints === "object"
        ) {
          graphqlCatalogCache = existing;
          return graphqlCatalogCache;
        }
        graphqlCatalogCache = createEmptyCatalog();
        return graphqlCatalogCache;
      })
      .catch(() => {
        graphqlCatalogCache = createEmptyCatalog();
        return graphqlCatalogCache;
      })
      .finally(() => {
        graphqlCatalogLoadPromise = null;
      });
  }
  return graphqlCatalogLoadPromise;
}

async function flushGraphqlCatalog() {
  if (!catalogDirty || !graphqlCatalogCache) return;
  catalogDirty = false;
  try {
    await chrome.storage.local.set({
      [GRAPHQL_CATALOG_STORAGE_KEY]: graphqlCatalogCache,
    });
  } catch {
    // Keep dirty so the next request attempts to flush again.
    catalogDirty = true;
  }
}

function scheduleCatalogFlush() {
  if (catalogFlushTimer) return;
  catalogFlushTimer = setTimeout(() => {
    catalogFlushTimer = null;
    flushGraphqlCatalog();
  }, CATALOG_FLUSH_DELAY_MS);
}

async function captureGraphqlEndpoint(details) {
  const parsed = parseGraphqlEndpoint(details.url);
  if (!parsed) return;

  const catalog = await loadGraphqlCatalog();
  const key = `${parsed.operation}:${parsed.queryId}`;
  const now = Date.now();
  const current = catalog.endpoints[key] || {
    key,
    operation: parsed.operation,
    queryId: parsed.queryId,
    path: parsed.path,
    firstSeen: now,
    lastSeen: now,
    seenCount: 0,
    methods: [],
    sampleUrl: parsed.fullUrl,
    sampleVariables: null,
    sampleFeatures: null,
    sampleFieldToggles: null,
  };

  current.lastSeen = now;
  current.seenCount += 1;
  current.sampleUrl = parsed.fullUrl;
  current.path = parsed.path;
  if (details.method && !current.methods.includes(details.method)) {
    current.methods.push(details.method);
  }
  if (parsed.variables) current.sampleVariables = parsed.variables;
  if (parsed.features) current.sampleFeatures = parsed.features;
  if (parsed.fieldToggles) current.sampleFieldToggles = parsed.fieldToggles;

  catalog.endpoints[key] = current;
  catalog.updatedAt = now;
  enforceCatalogLimit(catalog);
  catalogDirty = true;
  scheduleCatalogFlush();
}

// NOTE: parseJsonMaybe is intentionally duplicated — similar to parseMaybeJson
// in the app source. Service workers cannot import from src/.
function parseJsonMaybe(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// GRAPHQL DOCS EXPORT
// ═══════════════════════════════════════════════════════════

function formatDateTime(epochMs) {
  if (!epochMs || typeof epochMs !== "number") return "n/a";
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toISOString();
}

function escapeMarkdown(value) {
  return String(value || "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function markdownForParam(label, rawValue) {
  if (!rawValue) return "";
  const parsed = parseJsonMaybe(rawValue);
  const content =
    parsed !== null ? JSON.stringify(parsed, null, 2) : String(rawValue);
  const fence = content.includes("```") ? "````" : "```";
  return `\n${label}\n${fence}json\n${content}\n${fence}\n`;
}

function buildGraphqlDocsMarkdown(catalog) {
  const endpoints = Object.values(catalog.endpoints || {}).sort(
    (a, b) => b.lastSeen - a.lastSeen,
  );

  const operationCounts = {};
  for (const endpoint of endpoints) {
    operationCounts[endpoint.operation] =
      (operationCounts[endpoint.operation] || 0) + 1;
  }
  const operationRows = Object.entries(operationCounts).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const lines = [
    "# X GraphQL API Docs (Captured)",
    "",
    "_Generated from your own browser traffic. This is not an official X schema dump._",
    "",
    `Generated at: ${formatDateTime(Date.now())}`,
    `Catalog updated at: ${formatDateTime(catalog.updatedAt)}`,
    `Endpoints captured: ${endpoints.length}`,
    `Unique operations: ${operationRows.length}`,
    "",
  ];

  if (operationRows.length > 0) {
    lines.push("## Operation Summary", "");
    lines.push("| Operation | Endpoint Variants |");
    lines.push("| --- | ---: |");
    for (const [operation, count] of operationRows) {
      lines.push(`| ${escapeMarkdown(operation)} | ${count} |`);
    }
    lines.push("");
  }

  if (endpoints.length === 0) {
    lines.push(
      "No endpoints captured yet. Open `https://x.com` and browse timelines/bookmarks, then export again.",
    );
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Endpoint Details", "");
  for (const endpoint of endpoints) {
    lines.push(`### ${endpoint.operation} (${endpoint.queryId})`, "");
    lines.push(`- Path: \`${endpoint.path}\``);
    lines.push(`- Methods: ${endpoint.methods.join(", ") || "GET"}`);
    lines.push(`- Seen count: ${endpoint.seenCount}`);
    lines.push(`- First seen: ${formatDateTime(endpoint.firstSeen)}`);
    lines.push(`- Last seen: ${formatDateTime(endpoint.lastSeen)}`);
    lines.push(`- Sample URL: ${endpoint.sampleUrl}`);
    lines.push(markdownForParam("#### variables", endpoint.sampleVariables));
    lines.push(markdownForParam("#### features", endpoint.sampleFeatures));
    lines.push(
      markdownForParam("#### fieldToggles", endpoint.sampleFieldToggles),
    );
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

async function handleGetGraphqlCatalog() {
  const catalog = await loadGraphqlCatalog();
  const endpoints = Object.values(catalog.endpoints || {}).sort(
    (a, b) => b.lastSeen - a.lastSeen,
  );
  return {
    data: {
      generatedAt: Date.now(),
      updatedAt: catalog.updatedAt,
      endpoints,
    },
  };
}

async function handleExportGraphqlDocs() {
  const catalog = await loadGraphqlCatalog();
  const markdown = buildGraphqlDocsMarkdown(catalog);
  const fileStamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    data: {
      markdown,
      fileName: `x-graphql-api-docs-${fileStamp}.md`,
      generatedAt: Date.now(),
    },
  };
}

// ═══════════════════════════════════════════════════════════
// BOOKMARK EVENTS
// ═══════════════════════════════════════════════════════════

async function pushBookmarkEvent(type, tweetId, source) {
  const normalizedTweetId = typeof tweetId === "string" ? tweetId : "";
  const now = Date.now();
  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const existing = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  const next = existing
    .filter(
      (event) =>
        !(
          event &&
          event.tweetId === normalizedTweetId &&
          event.type === type &&
          now - Number(event.at || 0) < 1000
        ),
    )
    .concat({
      id: `${now}-${type}-${normalizedTweetId || "unknown"}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      tweetId: normalizedTweetId,
      at: now,
      source,
    });

  if (next.length > MAX_BOOKMARK_EVENTS) {
    next.splice(0, next.length - MAX_BOOKMARK_EVENTS);
  }

  await chrome.storage.local.set({ [BOOKMARK_EVENTS_STORAGE_KEY]: next });
}

async function handleDrainBookmarkEvents() {
  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const events = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  if (events.length > 0) {
    await chrome.storage.local.set({ [BOOKMARK_EVENTS_STORAGE_KEY]: [] });
  }

  return { data: { events } };
}

async function handleGetBookmarkEvents() {
  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const events = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];
  return { data: { events } };
}

async function handleAckBookmarkEvents(ids) {
  const ackSet = new Set(
    Array.isArray(ids)
      ? ids.filter((id) => typeof id === "string" && id.length > 0)
      : [],
  );
  if (ackSet.size === 0) {
    return { data: { removed: 0, remaining: 0 } };
  }

  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const events = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  const next = events.filter((event) => {
    if (!event || typeof event !== "object") return false;
    const id = typeof event.id === "string" ? event.id : "";
    return id ? !ackSet.has(id) : true;
  });

  await chrome.storage.local.set({ [BOOKMARK_EVENTS_STORAGE_KEY]: next });
  return {
    data: {
      removed: events.length - next.length,
      remaining: next.length,
    },
  };
}

async function handleBookmarkMutationMessage(message) {
  const operation =
    message?.operation === "CreateBookmark" || message?.operation === "DeleteBookmark"
      ? message.operation
      : null;
  if (!operation) return { ok: false };

  const tweetId = typeof message?.tweetId === "string" ? message.tweetId : "";
  const source = typeof message?.source === "string" ? message.source : "content-script";
  await pushBookmarkEvent(operation, tweetId, source);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════
// BOOKMARK MUTATION CAPTURE (webRequest)
// ═══════════════════════════════════════════════════════════

function decodeBodyBytes(bytes) {
  if (!bytes) return "";
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function extractTweetIdFromVariables(variables) {
  if (!variables || typeof variables !== "object") return null;
  const tweetId =
    variables.tweet_id ||
    variables.tweetId ||
    variables.focalTweetId ||
    variables.target_tweet_id ||
    variables.targetTweetId;
  return typeof tweetId === "string" && tweetId ? tweetId : null;
}

function extractTweetIdFromRequestBody(requestBody) {
  if (!requestBody) return null;

  if (requestBody.formData) {
    const formData = requestBody.formData;
    const direct = formData.tweet_id || formData.tweetId;
    if (Array.isArray(direct) && typeof direct[0] === "string" && direct[0]) {
      return direct[0];
    }

    const variablesRaw = Array.isArray(formData.variables)
      ? formData.variables[0]
      : null;
    const parsed = parseJsonMaybe(variablesRaw);
    const tweetId = extractTweetIdFromVariables(parsed);
    if (tweetId) return tweetId;
  }

  const rawParts = Array.isArray(requestBody.raw) ? requestBody.raw : [];
  for (const part of rawParts) {
    const text = decodeBodyBytes(part.bytes).trim();
    if (!text) continue;

    const parsedJson = parseJsonMaybe(text);
    if (parsedJson && typeof parsedJson === "object") {
      const direct = extractTweetIdFromVariables(parsedJson.variables);
      if (direct) return direct;
      const nested = extractTweetIdFromVariables(parsedJson);
      if (nested) return nested;
    }

    const search = new URLSearchParams(text);
    const varsFromQuery = parseJsonMaybe(search.get("variables"));
    const fromVars = extractTweetIdFromVariables(varsFromQuery);
    if (fromVars) return fromVars;
    const direct = search.get("tweet_id") || search.get("tweetId");
    if (direct) return direct;
  }

  return null;
}

function parseBookmarkMutation(urlString) {
  const match = urlString.match(
    /\/i\/api\/graphql\/([^/]+)\/(DeleteBookmark|CreateBookmark)(?:\?|$)/,
  );
  if (!match) return null;
  return {
    queryId: match[1],
    operation: match[2],
  };
}

function getHeaderValue(headers, name) {
  if (!Array.isArray(headers)) return "";
  const target = String(name || "").toLowerCase();
  for (const header of headers) {
    if (!header || typeof header !== "object") continue;
    if (String(header.name || "").toLowerCase() === target) {
      return typeof header.value === "string" ? header.value : "";
    }
  }
  return "";
}

function extractTweetIdFromReferer(referer) {
  if (!referer || typeof referer !== "string") return null;
  const match = referer.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function isExtensionInitiated(details) {
  return (
    typeof details?.initiator === "string" &&
    details.initiator.startsWith("chrome-extension://")
  );
}

async function captureBookmarkMutation(details) {
  if (isExtensionInitiated(details)) return;
  const mutation = parseBookmarkMutation(details.url);
  if (!mutation) return;

  const tweetId = extractTweetIdFromRequestBody(details.requestBody) || "";

  if (mutation.operation === "DeleteBookmark") {
    await chrome.storage.local.set({ tw_delete_query_id: mutation.queryId });
    await pushBookmarkEvent("DeleteBookmark", tweetId, "x.com");
  }

  if (mutation.operation === "CreateBookmark") {
    await chrome.storage.local.set({ tw_create_query_id: mutation.queryId });
    await pushBookmarkEvent("CreateBookmark", tweetId, "x.com");
  }
}

// ═══════════════════════════════════════════════════════════
// WEEKLY CLEANUP
// ═══════════════════════════════════════════════════════════

async function runWeeklyServiceWorkerCleanup() {
  const now = Date.now();
  const stored = await chrome.storage.local.get([
    WEEKLY_SW_CLEANUP_KEY,
    BOOKMARK_EVENTS_STORAGE_KEY,
    GRAPHQL_CATALOG_STORAGE_KEY,
  ]);
  const lastCleanupAt = Number(stored[WEEKLY_SW_CLEANUP_KEY] || 0);
  if (now - lastCleanupAt < WEEKLY_SW_CLEANUP_INTERVAL_MS) {
    return;
  }

  const updates = {
    [WEEKLY_SW_CLEANUP_KEY]: now,
  };

  const existingEvents = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];
  const eventsCutoff = now - BOOKMARK_EVENT_RETENTION_MS;
  const prunedEvents = existingEvents.filter(
    (event) => Number(event?.at || 0) >= eventsCutoff,
  );
  if (prunedEvents.length !== existingEvents.length) {
    updates[BOOKMARK_EVENTS_STORAGE_KEY] = prunedEvents;
  }

  const existingCatalog = stored[GRAPHQL_CATALOG_STORAGE_KEY];
  if (
    existingCatalog &&
    typeof existingCatalog === "object" &&
    !Array.isArray(existingCatalog) &&
    typeof existingCatalog.endpoints === "object" &&
    existingCatalog.endpoints
  ) {
    const endpointCutoff = now - GRAPHQL_ENDPOINT_RETENTION_MS;
    const nextEndpoints = {};
    let changed = false;

    for (const [key, entry] of Object.entries(existingCatalog.endpoints)) {
      if (!entry || typeof entry !== "object") {
        changed = true;
        continue;
      }

      const lastSeen = Number(entry.lastSeen || 0);
      if (lastSeen < endpointCutoff) {
        changed = true;
        continue;
      }

      nextEndpoints[key] = entry;
    }

    if (changed) {
      const nextCatalog = {
        ...existingCatalog,
        endpoints: nextEndpoints,
        updatedAt: now,
      };
      updates[GRAPHQL_CATALOG_STORAGE_KEY] = nextCatalog;
      graphqlCatalogCache = nextCatalog;
      catalogDirty = false;
    }
  }

  await chrome.storage.local.set(updates);
}

// ═══════════════════════════════════════════════════════════
// API REQUEST HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleCheckAuth() {
  const stored = await chrome.storage.local.get([
    "current_user_id",
    "tw_auth_headers",
    "tw_auth_time",
    "tw_query_id",
  ]);

  const userId = await syncAuthSessionFromCookie(stored);
  const hasUser = Boolean(userId);

  return {
    hasUser,
    hasAuth: hasUser && !!(stored.tw_auth_headers?.authorization),
    hasQueryId: !!stored.tw_query_id,
    userId,
  };
}

async function handleFetchBookmarks(cursor, _retried = false) {
  const stored = await chrome.storage.local.get([
    "tw_auth_headers",
    "tw_query_id",
    "tw_features",
  ]);

  if (!stored.tw_auth_headers?.authorization) throw new Error("NO_AUTH");
  if (!stored.tw_query_id) throw new Error("NO_QUERY_ID");

  const variables = { count: 20, includePromotedContent: true };
  if (cursor) variables.cursor = cursor;

  const features = stored.tw_features || JSON.stringify(DEFAULT_FEATURES);

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: features,
  });

  const url = `https://x.com/i/api/graphql/${stored.tw_query_id}/Bookmarks?${params}`;
  const requestHeaders = await buildHeaders();

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: requestHeaders,
  });

  if (response.status === 401 || response.status === 403) {
    if (!_retried) {
      await chrome.storage.local.remove(["tw_auth_headers", "tw_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleFetchBookmarks(cursor, true);
    }
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API_ERROR_${response.status}: ${body.slice(0, 200)}`);
  }

  return { data: await response.json() };
}

async function handleDeleteBookmark(tweetId, _retried = false) {
  if (!tweetId) throw new Error("MISSING_TWEET_ID");

  const stored = await chrome.storage.local.get([
    "tw_auth_headers",
    "tw_delete_query_id",
  ]);
  if (!stored.tw_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryIds = Array.from(
    new Set(
      [stored.tw_delete_query_id, ...FALLBACK_DELETE_BOOKMARK_QUERY_IDS].filter(
        Boolean,
      ),
    ),
  );

  const requestHeaders = await buildHeaders();
  let lastError = "DELETE_BOOKMARK_FAILED";

  for (const queryId of queryIds) {
    const url = `https://x.com/i/api/graphql/${queryId}/DeleteBookmark`;
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: requestHeaders,
      body: JSON.stringify({
        variables: { tweet_id: tweetId },
        queryId,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      if (!_retried) {
        await chrome.storage.local.remove(["tw_auth_headers", "tw_auth_time"]);
        const success = await reAuthSilently();
        if (success) return handleDeleteBookmark(tweetId, true);
      }
      throw new Error("AUTH_EXPIRED");
    }

    if (response.ok) {
      if (stored.tw_delete_query_id !== queryId) {
        chrome.storage.local.set({ tw_delete_query_id: queryId });
      }
      await pushBookmarkEvent("DeleteBookmark", tweetId, "extension");
      return { ok: true, queryId, data: await response.json().catch(() => null) };
    }

    const body = await response.text().catch(() => "");
    lastError = `DELETE_BOOKMARK_${response.status}: ${body.slice(0, 200)}`;

    // 400/404 usually means stale query ID.
    if (response.status !== 400 && response.status !== 404) {
      break;
    }
  }

  throw new Error(lastError);
}

function parseFeatureSet(raw) {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return {};
}

async function handleFetchTweetDetail(tweetId, _retried = false) {
  const stored = await chrome.storage.local.get([
    "tw_auth_headers",
    "tw_detail_query_id",
    "tw_features",
  ]);

  if (!stored.tw_auth_headers?.authorization) throw new Error("NO_AUTH");
  const queryIds = Array.from(
    new Set([
      stored.tw_detail_query_id,
      ...FALLBACK_DETAIL_QUERY_IDS,
    ].filter(Boolean)),
  );
  const featureSet = {
    ...DEFAULT_FEATURES,
    ...parseFeatureSet(stored.tw_features),
    ...DETAIL_FEATURE_OVERRIDES,
  };

  const variables = {
    focalTweetId: tweetId,
    with_rux_injections: false,
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true,
  };
  const requestHeaders = await buildHeaders();
  let lastError = "DETAIL_ERROR";
  const fieldToggleCandidates = [
    {
      withArticleRichContentState: true,
      withArticlePlainText: true,
      withGrokAnalyze: false,
    },
    {
      withArticleRichContentState: true,
      withArticlePlainText: false,
      withGrokAnalyze: false,
    },
  ];

  for (const fieldToggles of fieldToggleCandidates) {
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(featureSet),
      fieldToggles: JSON.stringify(fieldToggles),
    });
    for (const queryId of queryIds) {
      const url = `https://x.com/i/api/graphql/${queryId}/TweetDetail?${params}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: requestHeaders,
      });

      if (response.status === 401 || response.status === 403) {
        if (!_retried) {
          await chrome.storage.local.remove(["tw_auth_headers", "tw_auth_time"]);
          const success = await reAuthSilently();
          if (success) return handleFetchTweetDetail(tweetId, true);
        }
        throw new Error("AUTH_EXPIRED");
      }

      if (response.ok) {
        if (stored.tw_detail_query_id !== queryId) {
          chrome.storage.local.set({ tw_detail_query_id: queryId });
        }
        return { data: await response.json() };
      }

      const body = await response.text().catch(() => "");
      lastError = `DETAIL_ERROR_${response.status}: ${body.slice(0, 200)}`;

      // 400/404 often indicates stale query ID or toggle mismatch.
      if (response.status !== 400 && response.status !== 404) {
        break;
      }
    }
  }

  throw new Error(lastError);
}

// ═══════════════════════════════════════════════════════════
// WEB REQUEST LISTENERS
// ═══════════════════════════════════════════════════════════

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders) return;

    const headers = {};
    for (const header of details.requestHeaders) {
      const name = header.name.toLowerCase();
      if (CAPTURED_HEADERS.has(name)) {
        headers[name] = header.value;
      }
    }

    if (headers["authorization"] && headers["cookie"] && headers["x-csrf-token"]) {
      chrome.storage.local.set({
        tw_auth_headers: headers,
        tw_auth_time: Date.now(),
      });
    }

    captureGraphqlEndpoint(details);

    // Capture bookmarks query ID + features
    const match = details.url.match(/\/i\/api\/graphql\/([^/]+)\/Bookmarks\?(.+)/);
    if (match) {
      const queryId = match[1];
      try {
        const params = new URLSearchParams(match[2]);
        const toStore = { tw_query_id: queryId };
        const features = params.get("features");
        if (features) toStore.tw_features = features;
        chrome.storage.local.set(toStore);
      } catch {
        chrome.storage.local.set({ tw_query_id: queryId });
      }
    }

    // Capture TweetDetail query ID
    const detailMatch = details.url.match(/\/i\/api\/graphql\/([^/]+)\/TweetDetail/);
    if (detailMatch) {
      chrome.storage.local.set({ tw_detail_query_id: detailMatch[1] });
    }

    const deleteMatch = details.url.match(
      /\/i\/api\/graphql\/([^/]+)\/DeleteBookmark(?:\?|$)/,
    );
    if (deleteMatch) {
      chrome.storage.local.set({ tw_delete_query_id: deleteMatch[1] });
    }

    const createMatch = details.url.match(
      /\/i\/api\/graphql\/([^/]+)\/CreateBookmark(?:\?|$)/,
    );
    if (createMatch) {
      chrome.storage.local.set({ tw_create_query_id: createMatch[1] });
    }

    const mutation = parseBookmarkMutation(details.url);
    if (mutation) {
      const referer = getHeaderValue(details.requestHeaders, "referer");
      const tweetId = extractTweetIdFromReferer(referer) || "";
      chrome.storage.local
        .set({
          tw_last_bookmark_mutation: {
            at: Date.now(),
            operation: mutation.operation,
            url: details.url,
            referer,
            tweetId,
            initiator: details.initiator || "",
          },
        })
        .catch(() => {});
      pushBookmarkEvent(mutation.operation, tweetId, "x.com-headers").catch(
        () => {},
      );
    }
  },
  { urls: ["https://x.com/i/api/graphql/*"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    captureBookmarkMutation(details).catch(() => {});
  },
  {
    urls: [
      "https://x.com/i/api/graphql/*/DeleteBookmark*",
      "https://x.com/i/api/graphql/*/CreateBookmark*",
    ],
  },
  ["requestBody"],
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isExtensionInitiated(details)) return;
    if (details.statusCode < 200 || details.statusCode >= 300) return;
    const mutation = parseBookmarkMutation(details.url);
    if (!mutation) return;

    chrome.storage.local
      .set({
        tw_last_bookmark_mutation_completed: {
          at: Date.now(),
          operation: mutation.operation,
          url: details.url,
          statusCode: details.statusCode,
          initiator: details.initiator || "",
        },
      })
      .catch(() => {});

    // Fallback path: enqueue event even when request body/referer tweet id is unavailable.
    pushBookmarkEvent(mutation.operation, "", "x.com-completed").catch(() => {});
  },
  {
    urls: [
      "https://x.com/i/api/graphql/*/DeleteBookmark*",
      "https://x.com/i/api/graphql/*/CreateBookmark*",
    ],
  },
);

// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHECK_AUTH") {
    handleCheckAuth().then(sendResponse);
    return true;
  }
  if (message.type === "START_AUTH_CAPTURE") {
    chrome.tabs.create({ url: "https://x.com/i/bookmarks", active: false }, (tab) => {
      authTabId = tab.id;
      sendResponse({ tabId: tab.id });
    });
    return true;
  }
  if (message.type === "CLOSE_AUTH_TAB") {
    if (authTabId) {
      chrome.tabs.remove(authTabId).catch(() => {});
      authTabId = null;
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "FETCH_BOOKMARKS") {
    handleFetchBookmarks(message.cursor)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "FETCH_TWEET_DETAIL") {
    handleFetchTweetDetail(message.tweetId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "DELETE_BOOKMARK") {
    handleDeleteBookmark(message.tweetId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "BOOKMARK_MUTATION") {
    handleBookmarkMutationMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "DRAIN_BOOKMARK_EVENTS") {
    handleDrainBookmarkEvents()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "GET_BOOKMARK_EVENTS") {
    handleGetBookmarkEvents()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ACK_BOOKMARK_EVENTS") {
    handleAckBookmarkEvents(message.ids)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "GET_GRAPHQL_CATALOG") {
    handleGetGraphqlCatalog()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "EXPORT_GRAPHQL_DOCS") {
    handleExportGraphqlDocs()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "REAUTH_STATUS") {
    sendResponse({ inProgress: reauthInProgress });
    return false;
  }
  return false;
});

// ═══════════════════════════════════════════════════════════
// COOKIE LISTENER & STARTUP
// ═══════════════════════════════════════════════════════════

chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo?.cookie;
  if (!cookie || cookie.name !== "twid") return;

  const domain = String(cookie.domain || "")
    .replace(/^\./, "")
    .toLowerCase();
  if (!domain.endsWith("x.com")) return;

  // Ignore remove events caused by overwrite to avoid flicker while the new value is set.
  if (changeInfo.removed && changeInfo.cause === "overwrite") return;

  syncAuthSessionFromCookie().catch(() => {});
});

runWeeklyServiceWorkerCleanup().catch(() => {});
