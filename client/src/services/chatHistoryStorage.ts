/**
 * localStorage-backed chat history persistence, keyed by document id.
 * Both NewDocumentPage (post-save) and DocumentEditorPage read/write the
 * same keys so the conversation follows the document as the user navigates.
 */

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  serverContent?: string;
  attachments?: { name: string; type: string }[];
  timestamp: string;
  showGenerateButton?: boolean;
  options?: string[];
  requiresIntegration?: 'confluence' | 'jira';
  /** Optional expandable block rendered below the message (e.g. full import analysis). */
  expandable?: {
    label: string;
    /** Markdown content — rendered to HTML at display time. */
    markdown: string;
  };
}

const KEY_PREFIX = 'productos-chat:';

export function saveChatHistory(docId: string, messages: StoredMessage[]): void {
  try {
    localStorage.setItem(KEY_PREFIX + docId, JSON.stringify(messages));
  } catch {
    // localStorage full / disabled — silently drop
  }
}

export function loadChatHistory(docId: string): StoredMessage[] | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + docId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMessage[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearChatHistory(docId: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + docId);
  } catch {
    // ignore
  }
}
