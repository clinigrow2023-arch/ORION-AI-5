import type { ActionPlan, MessageTemplate, PlanStep } from "../types";

const MAX_PLAN_MESSAGES = 14;
const MAX_PLAN_MSG_CHARS = 350;

export function buildPlanContextFromMessages(
  messages: Array<{ text?: string; sender?: string }>
): string {
  if (!messages?.length) return "";

  const slice = messages.slice(-MAX_PLAN_MESSAGES);
  return slice
    .map((msg) => {
      const text = (msg.text || "").trim();
      if (!text) return "";
      const role =
        msg.sender === "user" ? "User" : "Orion";
      const clipped =
        text.length > MAX_PLAN_MSG_CHARS
          ? `${text.slice(0, MAX_PLAN_MSG_CHARS)}...`
          : text;
      return `${role}: ${clipped}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/** Fix common LLM JSON mistakes (trailing commas, smart quotes). */
export function repairPlanJsonText(raw: string): string {
  let s = stripMarkdownFences(raw);
  const match = s.match(/\{[\s\S]*\}/);
  if (match) s = match[0];
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

export function parsePlanJsonFromText(raw: string): unknown {
  const attempts = [raw.trim(), repairPlanJsonText(raw)];
  let lastError: Error | null = null;

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const match = candidate.match(/\{[\s\S]*\}/);
      if (match && match[0] !== candidate) {
        try {
          return JSON.parse(repairPlanJsonText(match[0]));
        } catch (inner) {
          lastError = inner instanceof Error ? inner : lastError;
        }
      }
    }
  }

  console.warn(
    "[plan] JSON parse failed, using empty object + normalizeActionPlan fillers:",
    lastError?.message
  );
  return {};
}

function asString(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function normalizeSteps(steps: unknown): PlanStep[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s, i) => {
      const row = s as Record<string, unknown>;
      return {
        stepNumber: Number(row.stepNumber) || i + 1,
        title: asString(row.title, `Step ${i + 1}`),
        description: asString(row.description, ""),
        duration: asString(row.duration, "3-5 days"),
      };
    })
    .filter((s) => s.description.length > 0)
    .slice(0, 3);
}

function normalizeTemplates(templates: unknown): MessageTemplate[] {
  if (!Array.isArray(templates)) return [];
  return templates
    .map((t) => {
      const row = t as Record<string, unknown>;
      return {
        situation: asString(row.situation, "General"),
        text: asString(row.text, ""),
        timing: asString(row.timing, "When appropriate"),
      };
    })
    .filter((t) => t.text.length > 0)
    .slice(0, 3);
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items.slice(0, 6) : fallback;
}

/** Coerce model output into a complete ActionPlan (fills gaps). */
export function normalizeActionPlan(raw: unknown): ActionPlan {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  let steps = normalizeSteps(o.steps);
  if (steps.length < 3) {
    const fillers: PlanStep[] = [
      {
        stepNumber: 1,
        title: "Stabilize communication",
        description:
          "Pause reactive texts. Match their pace. One calm check-in every 48-72h.",
        duration: "Days 1-4",
      },
      {
        stepNumber: 2,
        title: "Rebuild positive association",
        description:
          "Share one light, low-pressure memory or appreciation. No relationship talk yet.",
        duration: "Days 5-9",
      },
      {
        stepNumber: 3,
        title: "Create a natural reconnect window",
        description:
          "Suggest a brief, specific activity. Keep tone confident and warm.",
        duration: "Days 10-14",
      },
    ];
    steps = [...steps, ...fillers].slice(0, 3);
  }

  let messageTemplates = normalizeTemplates(o.messageTemplates);
  if (messageTemplates.length < 3) {
    messageTemplates = [
      ...messageTemplates,
      {
        situation: "After no reply",
        text: "Hey — no pressure. I’ll give you space. If you want to talk later, I’m here.",
        timing: "48h after last message",
      },
      {
        situation: "Warm re-open",
        text: "I was thinking about [specific positive memory]. It made me smile — hope your week’s going well.",
        timing: "Day 5-7",
      },
      {
        situation: "Invite to reconnect",
        text: "I’d enjoy catching up for a quick coffee/walk this week if you’re open. Either way, respect your pace.",
        timing: "Day 10+",
      },
    ].slice(0, 3);
  }

  return {
    diagnosis: asString(
      o.diagnosis,
      "Based on your chat, the main pattern is emotional distance mixed with unresolved tension. A paced, low-pressure reconnection plan is recommended."
    ),
    steps,
    messageTemplates,
    dos: normalizeStringList(o.dos, [
      "Stay consistent and calm",
      "Use short, clear messages",
      "Give space between outreach",
    ]),
    donts: normalizeStringList(o.donts, [
      "Do not double-text when anxious",
      "Avoid blame or long emotional dumps",
      "Do not pressure for immediate answers",
    ]),
    distancingStrategy: asString(
      o.distancingStrategy,
      "Use 48-72h strategic pauses after you reach out. Distancing reduces pressure and lets curiosity return."
    ),
    neurologicalTriggers: asString(
      o.neurologicalTriggers,
      "Use curiosity hooks, positive memory recall, and scarcity of attention — always with respect and warmth."
    ),
  };
}

export function isValidActionPlan(plan: ActionPlan): boolean {
  return (
    !!plan.diagnosis &&
    plan.steps.length >= 3 &&
    plan.messageTemplates.length >= 3
  );
}

/** Parse actionPlan JSON stored on Conversation (Mongo). */
export function parseStoredActionPlan(raw: string | null | undefined): ActionPlan | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = parsePlanJsonFromText(raw);
    const plan = normalizeActionPlan(parsed);
    return isValidActionPlan(plan) ? plan : null;
  } catch {
    return null;
  }
}
