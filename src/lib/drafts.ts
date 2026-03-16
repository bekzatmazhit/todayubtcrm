const PREFIX = "today_draft_";

/** Save a draft to localStorage. key should be unique per context (e.g. "task-comment-42") */
export function saveDraft(key: string, text: string) {
  try {
    if (!text.trim()) {
      localStorage.removeItem(PREFIX + key);
    } else {
      localStorage.setItem(PREFIX + key, text);
    }
  } catch { /* quota exceeded or private mode */ }
}

/** Load a draft from localStorage. Returns empty string if none. */
export function loadDraft(key: string): string {
  try {
    return localStorage.getItem(PREFIX + key) ?? "";
  } catch {
    return "";
  }
}

/** Clear a draft (call after successful submit). */
export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}
