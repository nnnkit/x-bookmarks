import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthStatus } from "../types";
import { checkAuth, startAuthCapture, closeAuthTab } from "../api/twitter";

type AuthPhase = "loading" | "need_login" | "connecting" | "ready";

interface UseAuthReturn {
  phase: AuthPhase;
  userId: string | null;
}

export function useAuth(): UseAuthReturn {
  const [phase, setPhase] = useState<AuthPhase>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const captureStarted = useRef(false);

  const doCheck = useCallback(async () => {
    try {
      const status: AuthStatus = await checkAuth();
      setUserId(status.userId);

      if (!status.hasUser) {
        captureStarted.current = false;
        setPhase("need_login");
        return;
      }

      if (status.hasAuth && status.hasQueryId) {
        // Fully connected — close background tab if still open
        captureStarted.current = false;
        closeAuthTab();
        setPhase("ready");
        return;
      }

      // User is logged in but we need to capture auth headers.
      // Auto-open background tab silently (once).
      setPhase("connecting");
      if (!captureStarted.current) {
        captureStarted.current = true;
        startAuthCapture();
        // Quick 500ms check after starting capture
        setTimeout(doCheck, 500);
      }
    } catch {
      captureStarted.current = false;
      setPhase("need_login");
    }
  }, []);

  // Initial check
  useEffect(() => {
    doCheck();
  }, [doCheck]);

  // React to storage changes (content script sets user_id, service worker sets auth)
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (
        changes.current_user_id ||
        changes.tw_auth_headers ||
        changes.tw_query_id
      ) {
        doCheck();
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [doCheck]);

  // Fallback polling while in "connecting" phase (1s for faster first-time UX)
  useEffect(() => {
    if (phase !== "connecting") return;
    const interval = setInterval(doCheck, 1000);
    return () => clearInterval(interval);
  }, [phase, doCheck]);

  return { phase, userId };
}
