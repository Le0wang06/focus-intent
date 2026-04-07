/**
 * Typed-ish bridge to the service worker. Every payload must include `type` (see {@link Msg}).
 */
export function sendToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}
