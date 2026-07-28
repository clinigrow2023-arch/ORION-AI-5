import type { ConversationSummary } from "./conversations-client";
import {
  formatDate,
  formatShortTime,
  getActiveLocale,
  translateActive,
} from "./i18n";

const PREVIEW_MAX = 72;

/**
 * Runs on the server too, where there is no single active language, so it never
 * returns a label: an empty preview is data, and the client names it.
 */
export function deriveConversationPreview(
  messages: Array<{ text?: string; sender?: string }>
): string {
  const withText = messages
    .map((m) => ({
      text: (m.text || "").trim(),
      sender: (m.sender || "").toLowerCase(),
    }))
    .filter((m) => m.text.length > 0);

  const firstUser = withText.find((m) => m.sender === "user");
  const source = firstUser?.text ?? withText[0]?.text;
  if (!source) return "";

  const cleaned = source
    .replace(/\*\*/g, "")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= PREVIEW_MAX) return cleaned;
  return `${cleaned.slice(0, PREVIEW_MAX - 3).trim()}...`;
}

export function formatConversationTitle(conv: ConversationSummary): string {
  const preview = conv.preview?.trim();
  if (preview) return preview;
  return translateActive("chat.conversations.untitled");
}

export function formatConversationSubtitle(conv: ConversationSummary): string {
  const locale = getActiveLocale();
  const date = formatDate(conv.updatedAt, locale);
  const time = formatShortTime(conv.updatedAt, locale);
  const count = conv.messageCount ?? 0;
  const messages =
    count === 1
      ? translateActive("chat.conversations.messageOne")
      : translateActive("chat.conversations.messageMany", { count });
  const planTag = conv.hasActionPlan
    ? ` · ${translateActive("chat.conversations.planSaved")}`
    : "";

  return `${date} · ${time} · ${messages}${planTag}`;
}

export function formatConversationLabel(conv: ConversationSummary): string {
  return `${formatConversationTitle(conv)} · ${formatConversationSubtitle(conv)}`;
}

export function formatConversationPreviewTitle(preview?: string | null): string {
  const p = preview?.trim();
  return p && p.length > 0
    ? p
    : translateActive("chat.conversations.thisConversation");
}
