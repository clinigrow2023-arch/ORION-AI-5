import { authService } from "./auth";

export type ConversationSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  hasActionPlan?: boolean;
  /** First user message (or first message) trimmed for list labels */
  preview?: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: Array<{ id?: string; text: string; sender: string; timestamp?: string }>;
  actionPlan?: unknown;
};

const SUMMARY_TTL_MS = 4000;
let summaryCache: { at: number; data: ConversationSummary[] } | null = null;
let summaryInFlight: Promise<ConversationSummary[]> | null = null;

const detailCache = new Map<
  string,
  { at: number; data: ConversationDetail | null }
>();
const detailInFlight = new Map<string, Promise<ConversationDetail | null>>();
const DETAIL_TTL_MS = 3000;

export function invalidateConversationsCache(conversationId?: string): void {
  summaryCache = null;
  if (conversationId) {
    detailCache.delete(conversationId);
    detailInFlight.delete(conversationId);
  } else {
    detailCache.clear();
    detailInFlight.clear();
  }
}

export async function fetchConversationsSummary(
  force = false
): Promise<ConversationSummary[]> {
  const now = Date.now();
  if (!force && summaryCache && now - summaryCache.at < SUMMARY_TTL_MS) {
    return summaryCache.data;
  }
  if (!force && summaryInFlight) return summaryInFlight;

  summaryInFlight = (async () => {
    try {
      const token = authService.getToken();
      if (!token) return [];

      const { getApiEndpoint } = await import("./api-endpoints");
      const response = await fetch(
        `${getApiEndpoint("conversations")}?summary=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const list = Array.isArray(data.conversations)
        ? (data.conversations as ConversationSummary[])
        : [];
      summaryCache = { at: Date.now(), data: list };
      return list;
    } catch {
      return [];
    } finally {
      summaryInFlight = null;
    }
  })();

  return summaryInFlight;
}

export async function fetchConversationDetail(
  conversationId: string,
  force = false
): Promise<ConversationDetail | null> {
  const now = Date.now();
  const cached = detailCache.get(conversationId);
  if (!force && cached && now - cached.at < DETAIL_TTL_MS) {
    return cached.data;
  }

  const inflight = detailInFlight.get(conversationId);
  if (!force && inflight) return inflight;

  const promise = (async () => {
    try {
      const token = authService.getToken();
      if (!token) return null;

      const { getApiEndpoint } = await import("./api-endpoints");
      const response = await fetch(
        `${getApiEndpoint("conversations")}?conversationId=${encodeURIComponent(conversationId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const conv = (data.conversation ?? null) as ConversationDetail | null;
      detailCache.set(conversationId, { at: Date.now(), data: conv });
      return conv;
    } catch {
      return null;
    } finally {
      detailInFlight.delete(conversationId);
    }
  })();

  detailInFlight.set(conversationId, promise);
  return promise;
}
