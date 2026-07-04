import { ref } from 'vue'

/**
 * Copies text to the clipboard and tracks which item was last copied (by an
 * arbitrary caller-supplied key), so a component can show brief "Copiado!"
 * feedback next to the specific element that was copied.
 */
export function useClipboard(feedbackMs = 1500) {
  const copiedKey = ref<string | null>(null)

  async function copy(key: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      copiedKey.value = key
      setTimeout(() => {
        if (copiedKey.value === key) copiedKey.value = null
      }, feedbackMs)
    } catch {
      // Clipboard access can fail (e.g. no secure context); the error text is
      // still manually selectable as a fallback (see the `user-select` override
      // on error elements).
    }
  }

  return { copiedKey, copy }
}
