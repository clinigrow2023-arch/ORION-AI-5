/**
 * Limits concurrent Ollama HTTP calls so one VPS does not accept
 * 50 parallel generations (multi-minute waits). Extra requests wait
 * briefly, then fail fast with 503.
 */

export class OllamaBusyError extends Error {
  readonly code = "BUSY";

  constructor(message: string) {
    super(message);
    this.name = "OllamaBusyError";
  }
}

export function isOllamaBusyError(err: unknown): err is OllamaBusyError {
  return err instanceof OllamaBusyError || (err as { code?: string })?.code === "BUSY";
}

function maxSlots(): number {
  const n = Number(process.env.OLLAMA_APP_MAX_CONCURRENT ?? 4);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : 4;
}

function maxWaitMs(): number {
  const n = Number(process.env.OLLAMA_QUEUE_MAX_WAIT_MS ?? 45_000);
  return Number.isFinite(n) && n >= 0 ? n : 45_000;
}

let active = 0;

export async function withOllamaInference<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    active = Math.max(0, active - 1);
  }
}

async function acquireSlot(): Promise<void> {
  const deadline = Date.now() + maxWaitMs();
  const pollMs = 400;

  while (active >= maxSlots()) {
    if (Date.now() >= deadline) {
      throw new OllamaBusyError(
        `Orion is busy (${maxSlots()} AI requests at once). Please wait a moment and try again.`
      );
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  active++;
}

export function ollamaQueueStats(): { active: number; max: number } {
  return { active, max: maxSlots() };
}
