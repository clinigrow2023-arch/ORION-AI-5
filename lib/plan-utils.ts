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
  const obj = s.match(/\{[\s\S]*\}/);
  const arr = s.match(/\[[\s\S]*\]/);
  if (obj) s = obj[0];
  else if (arr) s = arr[0];
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/'\s*:/g, '":').replace(/:\s*'/g, ': "');
  return s;
}

/** Close unbalanced { } [ ] outside of JSON strings. */
export function closeIncompleteJson(raw: string): string {
  let depth = 0;
  let depthB = 0;
  let inStr = false;
  let esc = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") depth = Math.max(0, depth - 1);
    else if (c === "[") depthB++;
    else if (c === "]") depthB = Math.max(0, depthB - 1);
  }

  let out = raw;
  if (inStr) {
    out += '"';
  }
  while (depthB > 0) {
    out += "]";
    depthB--;
  }
  while (depth > 0) {
    out += "}";
    depth--;
  }
  return out;
}

function parsePositionFromSyntaxError(msg: string): number | null {
  const m = msg.match(/position\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function tryJsonParse(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildParseCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const repaired = repairPlanJsonText(raw);
  const closed = closeIncompleteJson(repaired);
  const objSlice = trimmed.match(/\{[\s\S]*\}/)?.[0];
  const arrSlice = trimmed.match(/\[[\s\S]*\]/)?.[0];

  const out = [
    trimmed,
    repaired,
    closed,
    closeIncompleteJson(trimmed),
  ];
  if (objSlice) {
    out.push(objSlice, repairPlanJsonText(objSlice), closeIncompleteJson(objSlice));
  }
  if (arrSlice) {
    out.push(arrSlice, repairPlanJsonText(arrSlice), closeIncompleteJson(arrSlice));
  }
  return [...new Set(out.filter(Boolean))];
}

/** Lenient JSON parse — never throws; returns {} or [] fallback. */
export function tryParseJsonLoose(
  raw: string,
  fallback: unknown = {}
): unknown {
  let lastMsg = "";
  const candidates = buildParseCandidates(raw);

  for (const candidate of candidates) {
    const parsed = tryJsonParse(candidate);
    if (parsed !== null) return parsed;
    try {
      JSON.parse(candidate);
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      const pos = parsePositionFromSyntaxError(lastMsg);
      if (pos != null && pos > 10) {
        for (const cut of [pos, pos - 1, pos - 2, pos - 5, pos - 20]) {
          if (cut < 10) continue;
          const slice = closeIncompleteJson(
            repairPlanJsonText(candidate.slice(0, cut))
          );
          const sliced = tryJsonParse(slice);
          if (sliced !== null) return sliced;
        }
      }
    }
  }

  console.warn("[json] loose parse failed:", lastMsg);
  return fallback;
}

export function parsePlanJsonFromText(raw: string): unknown {
  return tryParseJsonLoose(raw, {});
}

export type StoredMessage = {
  id?: string;
  text?: string;
  sender?: string;
  timestamp?: string;
};

export function parseConversationMessages(
  raw: string | null | undefined
): StoredMessage[] {
  const text = (raw || "[]").trim();
  if (!text) return [];

  const parsed = tryParseJsonLoose(text, []);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (m): m is StoredMessage =>
      !!m && typeof m === "object" && ("text" in m || "sender" in m)
  );
}

/** Don't show raw SyntaxError text in the UI. */
export function friendlyPlanErrorMessage(message: string): string {
  if (
    /JSON at position/i.test(message) ||
    /Unexpected token/i.test(message) ||
    /not valid JSON/i.test(message)
  ) {
    return "The AI response had a formatting glitch. Tap Generate again — we’ll build your plan from the chat.";
  }
  if (/system memory|requires more.*memory|out of memory/i.test(message)) {
    return "This model needs more RAM than your PC has free. In .env set OLLAMA_MODEL and OLLAMA_PLAN_MODEL to a smaller model (e.g. gemma4 or qwen3.6), restart npm run dev, and try again.";
  }
  if (/Unterminated string|truncated|token limit/i.test(message)) {
    return "The AI cut off mid-response. Tap Generate again — or use llama3.2:3b in .env for more reliable plans.";
  }
  if (/model.*not found/i.test(message)) {
    return "That Ollama model is not installed. Run ollama pull <name> or change OLLAMA_PLAN_MODEL in .env to a model from ollama list.";
  }
  return message;
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
        stepNumber: i + 1,
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
