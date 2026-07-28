import { prisma } from "../api/_prisma.js";

export type AiUsageKind = "chat" | "plan";

/** Fire-and-forget — não bloqueia a resposta da IA. */
export function recordAiUsage(userId: string, kind: AiUsageKind): void {
  void prisma.aiUsageEvent
    .create({
      data: { userId, kind },
    })
    .catch((err) => {
      console.warn("[ai-usage] failed to record:", err);
    });
}

export type UsageBucket = {
  start: string;
  end: string;
  chatUsers: number;
  planUsers: number;
  totalUsers: number;
  chatEvents: number;
  planEvents: number;
};

export type UsageAnalytics = {
  hours: number;
  bucketMinutes: number;
  peakConcurrent: number;
  peakBucket: string | null;
  totalChatEvents: number;
  totalPlanEvents: number;
  uniqueUsers: number;
  buckets: UsageBucket[];
};

export async function getUsageAnalytics(
  hours: number,
  bucketMinutes: number
): Promise<UsageAnalytics> {
  const safeHours = Math.min(168, Math.max(1, hours));
  const safeBucket = Math.min(60, Math.max(5, bucketMinutes));
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);

  const events = await prisma.aiUsageEvent.findMany({
    where: { startedAt: { gte: since } },
    select: { userId: true, kind: true, startedAt: true },
    orderBy: { startedAt: "asc" },
  });

  const bucketMs = safeBucket * 60 * 1000;
  const startMs = since.getTime();
  const endMs = Date.now();
  const bucketCount = Math.ceil((endMs - startMs) / bucketMs);

  const buckets: UsageBucket[] = [];
  let peakConcurrent = 0;
  let peakBucket: string | null = null;

  for (let i = 0; i < bucketCount; i++) {
    const bStart = startMs + i * bucketMs;
    const bEnd = Math.min(bStart + bucketMs, endMs);
    const inBucket = events.filter((e) => {
      const t = e.startedAt.getTime();
      return t >= bStart && t < bEnd;
    });

    const chatUserIds = new Set(
      inBucket.filter((e) => e.kind === "chat").map((e) => e.userId)
    );
    const planUserIds = new Set(
      inBucket.filter((e) => e.kind === "plan").map((e) => e.userId)
    );
    const allUserIds = new Set(inBucket.map((e) => e.userId));
    const totalUsers = allUserIds.size;

    if (totalUsers > peakConcurrent) {
      peakConcurrent = totalUsers;
      peakBucket = new Date(bStart).toISOString();
    }

    buckets.push({
      start: new Date(bStart).toISOString(),
      end: new Date(bEnd).toISOString(),
      chatUsers: chatUserIds.size,
      planUsers: planUserIds.size,
      totalUsers,
      chatEvents: inBucket.filter((e) => e.kind === "chat").length,
      planEvents: inBucket.filter((e) => e.kind === "plan").length,
    });
  }

  const uniqueUsers = new Set(events.map((e) => e.userId)).size;

  return {
    hours: safeHours,
    bucketMinutes: safeBucket,
    peakConcurrent,
    peakBucket,
    totalChatEvents: events.filter((e) => e.kind === "chat").length,
    totalPlanEvents: events.filter((e) => e.kind === "plan").length,
    uniqueUsers,
    buckets,
  };
}
