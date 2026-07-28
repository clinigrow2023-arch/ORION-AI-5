import { DEFAULT_LOCALE, type Locale } from "./locale.js";

/**
 * Orion only answers in the languages available in the UI selector: EN (default)
 * and FR. Anything else is refused with a fixed reply in the account locale —
 * small local models are unreliable at self-policing this.
 */

const SCRIPT_UNSUPPORTED =
  /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]|[\u0600-\u06FF\u0750-\u077F]|[\u0590-\u05FF]|[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/u;

/**
 * Explicit asks to switch into a language we do not offer.
 * Avoid bare nationality words ("she's Portuguese") — only switch intents.
 */
const UNSUPPORTED_LANGUAGE_REQUEST =
  /\b(?:(?:speak|reply|answer|respond|write|talk|chat)\s+(?:(?:to\s+me|with\s+me|me)\s+)?(?:in\s+)?|(?:answer|reply|respond)\s+me\s+in\s+|in\s+)\s*(?:portuguese|portugu[eê]s|spanish|espa[nñ]ol|castellano|german|deutsch|italian|italiano|dutch|nederlands|polish|polski|russian|chinese|mandarin|japanese|arabic|turkish|hindi|korean|romanian|swedish|norwegian|danish)\b|\b(?:escrev[ae]|fal[ae]|responde|falando)\s+(?:(?:comigo|pra\s+mim|para\s+mim)\s+)?(?:em\s+)?(?:portugu[eê]s|espanhol|alem[aã]o|italiano)\b|\b(?:répond[sr]?|parle|écris)\s+(?:(?:moi|me)\s+)?(?:en\s+)?(?:portugais|espagnol|allemand|italien)\b|\b(?:sprich|antworte)\s+(?:(?:mir|auf)\s+)?(?:deutsch|portugiesisch|spanisch|italienisch)\b/i;

const PT_MARKERS = [
  "você",
  "voce",
  "não",
  "nao",
  "também",
  "tambem",
  "está",
  "esta",
  "estão",
  "estao",
  "minha",
  "meu",
  "nossa",
  "nosso",
  "porque",
  "porquê",
  "quero",
  "preciso",
  "ajuda",
  "namorada",
  "namorado",
  "relacionamento",
  "obrigado",
  "obrigada",
  "olá",
  "ola",
  "oi",
  "tudo bem",
  "como vai",
  "gostaria",
  "conseguir",
  "hoje",
  "amanhã",
  "amanha",
  "ontem",
  "ela me",
  "ele me",
  "a gente",
  "pra mim",
  "para mim",
  "não sei",
  "nao sei",
  "me ajuda",
  "me ajude",
];

const ES_MARKERS = [
  "hola",
  "usted",
  "ustedes",
  "también",
  "tambien",
  "está",
  "están",
  "estan",
  "necesito",
  "quiero",
  "ayuda",
  "novia",
  "novio",
  "relación",
  "relacion",
  "gracias",
  "por favor",
  "cómo",
  "como estás",
  "buenos días",
  "buenos dias",
  "qué puedo",
  "que puedo",
  "mi novia",
  "mi novio",
  "no sé",
  "no se",
  "ayúdame",
  "ayudame",
];

const DE_MARKERS = [
  "bitte",
  "hilfe",
  "freundin",
  "freund",
  "beziehung",
  "danke",
  "wie geht",
  "guten tag",
  "möchte",
  "mochte",
  "kannst du",
  "kann ich",
  "meine freundin",
  "mein freund",
];

const IT_MARKERS = [
  "ciao",
  "aiuto",
  "ragazza",
  "ragazzo",
  "relazione",
  "grazie",
  "per favore",
  "come stai",
  "vorrei",
  "mi aiuti",
  "la mia ragazza",
  "il mio ragazzo",
];

/** Strong EN/FR signals — reduce false positives on short mixed messages. */
const EN_MARKERS = [
  "the",
  "and",
  "you",
  "i",
  "my",
  "she",
  "he",
  "we",
  "is",
  "are",
  "was",
  "were",
  "have",
  "has",
  "with",
  "this",
  "that",
  "what",
  "how",
  "why",
  "please",
  "help",
  "relationship",
  "girlfriend",
  "boyfriend",
  "breakup",
  "broke up",
];

const FR_MARKERS = [
  "je",
  "tu",
  "il",
  "elle",
  "nous",
  "vous",
  "les",
  "des",
  "une",
  "est",
  "suis",
  "avec",
  "pour",
  "pas",
  "que",
  "qui",
  "dans",
  "mon",
  "ma",
  "mes",
  "aide",
  "s'il",
  "svp",
  "relation",
  "copine",
  "copain",
  "petite amie",
  "petit ami",
  "rupture",
  "bonjour",
  "merci",
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9àâäéèêëïîôùûüçñ'\s]+/i)
    .join(" ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function countMarkers(haystack: string, markers: string[]): number {
  let hits = 0;
  for (const marker of markers) {
    if (marker.includes(" ")) {
      if (haystack.includes(marker)) hits += 1;
      continue;
    }
    // Word-boundary style for single tokens
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(marker)}(?:$|\\s|[?.!,;:])`, "i");
    if (re.test(haystack)) hits += 1;
  }
  return hits;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when the user message is clearly outside EN/FR (or asks for such a language).
 * Ambiguous / short messages return false so the mentor can still help.
 */
export function isUnsupportedLanguageMessage(message: string): boolean {
  const text = typeof message === "string" ? message.trim() : "";
  if (text.length < 2) {
    return false;
  }

  if (SCRIPT_UNSUPPORTED.test(text)) {
    return true;
  }

  if (UNSUPPORTED_LANGUAGE_REQUEST.test(text)) {
    return true;
  }

  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const tokens = tokenize(text);
  if (tokens.length < 2) {
    return false;
  }

  const pt = countMarkers(normalized, PT_MARKERS);
  const es = countMarkers(normalized, ES_MARKERS);
  const de = countMarkers(normalized, DE_MARKERS);
  const it = countMarkers(normalized, IT_MARKERS);
  const en = countMarkers(normalized, EN_MARKERS);
  const fr = countMarkers(normalized, FR_MARKERS);

  const unsupported = Math.max(pt, es, de, it);
  const supported = Math.max(en, fr);

  // Need a clear unsupported signal that outpaces EN/FR.
  if (unsupported >= 2 && unsupported > supported) {
    return true;
  }

  // Longer Portuguese/Spanish messages often hit 3+ markers even with a few EN words.
  if (unsupported >= 3 && unsupported >= supported) {
    return true;
  }

  return false;
}

/** Fixed refusal shown as the assistant reply (not an HTTP error). */
export function unsupportedLanguageReply(locale: Locale = DEFAULT_LOCALE): string {
  if (locale === "fr") {
    return "Je n'ai pas accès à cette langue. Je ne peux répondre qu'en anglais ou en français — choisissez l'une de ces langues dans le menu.";
  }
  return "I don't have access to that language. I can only reply in English or French — please choose one in the language menu.";
}
