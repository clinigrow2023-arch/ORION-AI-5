import type { ActionPlan, MessageTemplate, PlanStep } from "../types";
import type { MessageKey } from "./i18n";
import { DEFAULT_LOCALE, type Locale } from "./locale";

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

/**
 * Provider failures arrive as raw technical text (SyntaxError, Ollama errors).
 * Classifying them into a stable code lets the UI translate the explanation,
 * instead of matching English substrings that break in another language.
 */
export type PlanErrorCode =
  | "malformed_json"
  | "out_of_memory"
  | "truncated"
  | "model_missing"
  | "unknown";

export function classifyPlanError(message: string): PlanErrorCode {
  if (
    /JSON at position/i.test(message) ||
    /Unexpected token/i.test(message) ||
    /not valid JSON/i.test(message)
  ) {
    return "malformed_json";
  }
  if (/system memory|requires more.*memory|out of memory/i.test(message)) {
    return "out_of_memory";
  }
  if (/Unterminated string|truncated|token limit/i.test(message)) {
    return "truncated";
  }
  if (/model.*not found/i.test(message)) {
    return "model_missing";
  }
  return "unknown";
}

const PLAN_ERROR_KEYS: Record<PlanErrorCode, MessageKey> = {
  malformed_json: "plan.errors.malformedJson",
  out_of_memory: "plan.errors.outOfMemory",
  truncated: "plan.errors.truncated",
  model_missing: "plan.errors.modelMissing",
  unknown: "plan.errors.failed",
};

/** Single mapping used by both the UI and the background job service. */
export function planErrorMessageKey(code: PlanErrorCode): MessageKey {
  return PLAN_ERROR_KEYS[code];
}

function asString(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

/**
 * Gap fillers for incomplete model output.
 *
 * This is user-facing plan content, so it exists per language. It lives here and
 * not in the UI catalog because `normalizeActionPlan` also runs on the server,
 * where the language comes from the request and never from a global.
 */
type PlanFallback = {
  step: (n: number) => string;
  stepDuration: string;
  templateSituation: string;
  templateTiming: string;
  steps: PlanStep[];
  templates: MessageTemplate[];
  diagnosis: string;
  dos: string[];
  donts: string[];
  distancingStrategy: string;
  neurologicalTriggers: string;
};

const PLAN_FALLBACKS: Record<Locale, PlanFallback> = {
  en: {
    step: (n) => `Step ${n}`,
    stepDuration: "3-5 days",
    templateSituation: "General",
    templateTiming: "When appropriate",
    steps: [
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
    ],
    templates: [
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
    ],
    diagnosis:
      "Based on your chat, the main pattern is emotional distance mixed with unresolved tension. A paced, low-pressure reconnection plan is recommended.",
    dos: [
      "Stay consistent and calm",
      "Use short, clear messages",
      "Give space between outreach",
    ],
    donts: [
      "Do not double-text when anxious",
      "Avoid blame or long emotional dumps",
      "Do not pressure for immediate answers",
    ],
    distancingStrategy:
      "Use 48-72h strategic pauses after you reach out. Distancing reduces pressure and lets curiosity return.",
    neurologicalTriggers:
      "Use curiosity hooks, positive memory recall, and scarcity of attention — always with respect and warmth.",
  },
  fr: {
    step: (n) => `Étape ${n}`,
    stepDuration: "3 à 5 jours",
    templateSituation: "Général",
    templateTiming: "Au moment opportun",
    steps: [
      {
        stepNumber: 1,
        title: "Stabiliser la communication",
        description:
          "Arrêtez les messages impulsifs. Adaptez-vous à son rythme. Un message calme toutes les 48 à 72 h.",
        duration: "Jours 1 à 4",
      },
      {
        stepNumber: 2,
        title: "Reconstruire une association positive",
        description:
          "Partagez un souvenir léger ou une marque d’appréciation, sans pression. Pas encore de discussion sur le couple.",
        duration: "Jours 5 à 9",
      },
      {
        stepNumber: 3,
        title: "Créer une occasion naturelle de renouer",
        description:
          "Proposez une activité brève et précise. Gardez un ton assuré et chaleureux.",
        duration: "Jours 10 à 14",
      },
    ],
    templates: [
      {
        situation: "Après une absence de réponse",
        text: "Salut — aucune pression. Je te laisse de l’espace. Si tu veux parler plus tard, je suis là.",
        timing: "48 h après le dernier message",
      },
      {
        situation: "Reprise chaleureuse",
        text: "Je pensais à [souvenir positif précis]. Ça m’a fait sourire — j’espère que ta semaine se passe bien.",
        timing: "Jours 5 à 7",
      },
      {
        situation: "Invitation à se revoir",
        text: "Ça me ferait plaisir de prendre un café ou de marcher un peu cette semaine, si tu es partant(e). Dans tous les cas, je respecte ton rythme.",
        timing: "À partir du jour 10",
      },
    ],
    diagnosis:
      "D’après votre conversation, le schéma principal est une distance émotionnelle mêlée à une tension non résolue. Un plan de reconnexion progressif et sans pression est recommandé.",
    dos: [
      "Restez constant et calme",
      "Utilisez des messages courts et clairs",
      "Laissez de l’espace entre vos prises de contact",
    ],
    donts: [
      "N’envoyez pas plusieurs messages d’affilée sous l’effet de l’anxiété",
      "Évitez les reproches et les longs épanchements",
      "N’exigez pas de réponse immédiate",
    ],
    distancingStrategy:
      "Faites des pauses stratégiques de 48 à 72 h après chaque prise de contact. La distance réduit la pression et laisse la curiosité revenir.",
    neurologicalTriggers:
      "Utilisez des accroches de curiosité, le rappel de souvenirs positifs et la rareté de l’attention — toujours avec respect et chaleur.",
  },
};

function fallbackFor(locale: Locale): PlanFallback {
  return PLAN_FALLBACKS[locale] ?? PLAN_FALLBACKS[DEFAULT_LOCALE];
}

function normalizeSteps(steps: unknown, fb: PlanFallback): PlanStep[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s, i) => {
      const row = s as Record<string, unknown>;
      return {
        stepNumber: i + 1,
        title: asString(row.title, fb.step(i + 1)),
        description: asString(row.description, ""),
        duration: asString(row.duration, fb.stepDuration),
      };
    })
    .filter((s) => s.description.length > 0)
    .slice(0, 3);
}

function normalizeTemplates(
  templates: unknown,
  fb: PlanFallback
): MessageTemplate[] {
  if (!Array.isArray(templates)) return [];
  return templates
    .map((t) => {
      const row = t as Record<string, unknown>;
      return {
        situation: asString(row.situation, fb.templateSituation),
        text: asString(row.text, ""),
        timing: asString(row.timing, fb.templateTiming),
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

/** Coerce model output into a complete ActionPlan (fills gaps in `locale`). */
export function normalizeActionPlan(
  raw: unknown,
  locale: Locale = DEFAULT_LOCALE
): ActionPlan {
  const fb = fallbackFor(locale);
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  let steps = normalizeSteps(o.steps, fb);
  if (steps.length < 3) {
    steps = [...steps, ...fb.steps].slice(0, 3);
  }

  let messageTemplates = normalizeTemplates(o.messageTemplates, fb);
  if (messageTemplates.length < 3) {
    messageTemplates = [...messageTemplates, ...fb.templates].slice(0, 3);
  }

  return {
    diagnosis: asString(o.diagnosis, fb.diagnosis),
    steps,
    messageTemplates,
    dos: normalizeStringList(o.dos, fb.dos),
    donts: normalizeStringList(o.donts, fb.donts),
    distancingStrategy: asString(o.distancingStrategy, fb.distancingStrategy),
    neurologicalTriggers: asString(
      o.neurologicalTriggers,
      fb.neurologicalTriggers
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
export function parseStoredActionPlan(
  raw: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE
): ActionPlan | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = parsePlanJsonFromText(raw);
    const plan = normalizeActionPlan(parsed, locale);
    return isValidActionPlan(plan) ? plan : null;
  } catch {
    return null;
  }
}
