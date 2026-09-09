/**
 * Strips Vue reactivity (and any other non-plain-data shape) before a value
 * crosses the contextBridge/IPC boundary — `window.api.*` calls fail with
 * "object could not be cloned" if handed a `reactive()`/`ref()`-wrapped
 * object or array directly, since Proxies aren't structured-cloneable.
 */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
