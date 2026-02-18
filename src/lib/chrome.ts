export function hasChromeStorageSync(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.sync);
}

export function hasChromeStorageOnChanged(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.onChanged);
}
