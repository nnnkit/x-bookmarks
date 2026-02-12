// Content script: runs at document_start on x.com
// Reads the twid cookie to detect the logged-in user ID
(function () {
  const MESSAGE_SOURCE = "xbt-bookmark-mutation";

  const cookies = document.cookie.split(";");
  for (const item of cookies) {
    const [key, value] = item.trim().split("=");
    if (key === "twid" && value) {
      // twid cookie format: u%3D<numeric_user_id>
      const userId = value.replace("u%3D", "");
      if (userId) {
        chrome.storage.local.set({ current_user_id: userId });
      }
      break;
    }
  }

  function handleBookmarkMutationMessage(event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.__source !== MESSAGE_SOURCE) return;

    const operation =
      data.operation === "CreateBookmark" || data.operation === "DeleteBookmark"
        ? data.operation
        : null;
    if (!operation) return;

    const tweetId = typeof data.tweetId === "string" ? data.tweetId : "";
    chrome.runtime.sendMessage({
      type: "BOOKMARK_MUTATION",
      operation,
      tweetId,
      source: "injected-script",
    });
  }

  window.addEventListener("message", handleBookmarkMutationMessage);

  function injectMutationHook() {
    const script = document.createElement("script");
    script.textContent = `(() => {
      if (window.__xbtBookmarkMutationHookInstalled) return;
      window.__xbtBookmarkMutationHookInstalled = true;

      const SOURCE = "${MESSAGE_SOURCE}";

      const parseTweetIdFromObject = (obj) => {
        if (!obj || typeof obj !== "object") return "";
        const variables = obj.variables && typeof obj.variables === "object" ? obj.variables : null;
        return (
          (variables && (variables.tweet_id || variables.tweetId || "")) ||
          obj.tweet_id ||
          obj.tweetId ||
          ""
        ) || "";
      };

      const parseTweetId = (body) => {
        if (!body) return "";

        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            const fromJson = parseTweetIdFromObject(parsed);
            if (fromJson) return String(fromJson);
          } catch {}

          try {
            const search = new URLSearchParams(body);
            const vars = search.get("variables");
            if (vars) {
              try {
                const parsedVars = JSON.parse(vars);
                const fromVars = parseTweetIdFromObject({ variables: parsedVars });
                if (fromVars) return String(fromVars);
              } catch {}
            }
            const direct = search.get("tweet_id") || search.get("tweetId");
            if (direct) return String(direct);
          } catch {}

          return "";
        }

        if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
          const vars = body.get("variables");
          if (vars) {
            try {
              const parsedVars = JSON.parse(vars);
              const fromVars = parseTweetIdFromObject({ variables: parsedVars });
              if (fromVars) return String(fromVars);
            } catch {}
          }
          const direct = body.get("tweet_id") || body.get("tweetId");
          if (direct) return String(direct);
          return "";
        }

        if (typeof FormData !== "undefined" && body instanceof FormData) {
          const direct = body.get("tweet_id") || body.get("tweetId");
          if (typeof direct === "string" && direct) return direct;
          const vars = body.get("variables");
          if (typeof vars === "string" && vars) {
            try {
              const parsedVars = JSON.parse(vars);
              const fromVars = parseTweetIdFromObject({ variables: parsedVars });
              if (fromVars) return String(fromVars);
            } catch {}
          }
          return "";
        }

        const fromObject = parseTweetIdFromObject(body);
        return fromObject ? String(fromObject) : "";
      };

      const operationFromUrl = (url) => {
        if (!url) return "";
        if (/\\/CreateBookmark(?:\\?|$)/.test(url)) return "CreateBookmark";
        if (/\\/DeleteBookmark(?:\\?|$)/.test(url)) return "DeleteBookmark";
        return "";
      };

      const emit = (operation, tweetId) => {
        window.postMessage(
          {
            __source: SOURCE,
            operation,
            tweetId: tweetId || "",
          },
          "*",
        );
      };

      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (...args) {
        try {
          this.__xbtUrl = typeof args[1] === "string" ? args[1] : "";
        } catch {}
        return originalOpen.apply(this, args);
      };

      XMLHttpRequest.prototype.send = function (body) {
        try {
          const operation = operationFromUrl(this.__xbtUrl || "");
          if (operation) {
            emit(operation, parseTweetId(body));
          }
        } catch {}
        return originalSend.apply(this, arguments);
      };

      const originalFetch = window.fetch;
      window.fetch = function (input, init) {
        try {
          const url =
            typeof input === "string"
              ? input
              : input && typeof input.url === "string"
                ? input.url
                : "";
          const operation = operationFromUrl(url);
          if (operation) {
            emit(operation, parseTweetId(init && init.body));
          }
        } catch {}
        return originalFetch.apply(this, arguments);
      };
    })();`;
    (document.documentElement || document.head || document.body).appendChild(
      script,
    );
    script.remove();
  }

  injectMutationHook();
})();
