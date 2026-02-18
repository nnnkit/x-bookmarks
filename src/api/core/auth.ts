import type { AuthStatus } from "../../types";

export interface ReauthStatus {
  inProgress: boolean;
}

export async function checkAuth(): Promise<AuthStatus> {
  return chrome.runtime.sendMessage({ type: "CHECK_AUTH" });
}

export async function startAuthCapture(): Promise<{ tabId?: number }> {
  return chrome.runtime.sendMessage({ type: "START_AUTH_CAPTURE" });
}

export async function closeAuthTab(): Promise<void> {
  await chrome.runtime.sendMessage({ type: "CLOSE_AUTH_TAB" });
}

export async function checkReauthStatus(): Promise<ReauthStatus> {
  return chrome.runtime.sendMessage({ type: "REAUTH_STATUS" });
}
