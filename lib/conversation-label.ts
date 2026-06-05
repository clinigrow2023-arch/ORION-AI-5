import type { ConversationSummary } from "./conversations-client";

const PREVIEW_MAX = 72;

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
  if (!source) return "New conversation";

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
  return "New conversation";
}

export function formatConversationSubtitle(conv: ConversationSummary): string {
  const date = new Date(conv.updatedAt).toLocaleDateString();
  const time = new Date(conv.updatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const msgs = conv.messageCount ?? 0;
  const planTag = conv.hasActionPlan ? " · plan saved" : "";
  return `${date} · ${time} · ${msgs} message${msgs === 1 ? "" : "s"}${planTag}`;
}

export function formatConversationLabel(conv: ConversationSummary): string {
  return `${formatConversationTitle(conv)} · ${formatConversationSubtitle(conv)}`;
}

export function formatConversationPreviewTitle(preview?: string | null): string {
  const p = preview?.trim();
  return p && p.length > 0 ? p : "your conversation";
}
