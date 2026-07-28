import { Ollama3Provider } from "./ollama3.js";
import { getSystemInstruction, useOllamaModelfile } from "./prompts.js";
import { withOllamaInference } from "../../lib/ollama-queue.js";
import {
  resolveOllamaChatModel,
  resolveOllamaPlanModel,
} from "../../lib/ollama-model-env.js";
import { DEFAULT_LOCALE, type Locale } from "../../lib/locale.js";

async function resolveChatSystemInstruction(locale: Locale): Promise<string> {
  if (useOllamaModelfile()) {
    return "";
  }
  return getSystemInstruction(locale);
}

let ollamaProvider: Ollama3Provider | null = null;

function getOllamaProvider(): Ollama3Provider {
  if (!ollamaProvider) {
    const baseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const model = resolveOllamaChatModel();
    const apiKey = process.env.OLLAMA_API_KEY;
    ollamaProvider = new Ollama3Provider(baseUrl, model, apiKey);
  }
  return ollamaProvider;
}

export async function sendMessageWithOllama(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  locale: Locale = DEFAULT_LOCALE
): Promise<string> {
  const provider = getOllamaProvider();
  const systemInstruction = await resolveChatSystemInstruction(locale);
  const response = await withOllamaInference(() =>
    provider.sendMessage(message, history, systemInstruction, locale)
  );
  if (!response?.trim()) {
    throw new Error("Ollama returned an empty response");
  }
  return response;
}

export async function sendMessageStreamWithOllama(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  onChunk: (chunk: string) => void,
  locale: Locale = DEFAULT_LOCALE
): Promise<string> {
  const provider = getOllamaProvider();
  const systemInstruction = await resolveChatSystemInstruction(locale);
  const response = await withOllamaInference(() =>
    provider.sendMessageStream(
      message,
      history,
      systemInstruction,
      onChunk,
      locale
    )
  );
  if (!response?.trim()) {
    throw new Error("Ollama returned an empty response");
  }
  return response;
}

function getPlanOllamaProvider(): Ollama3Provider {
  const baseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const planModel = resolveOllamaPlanModel();
  const apiKey = process.env.OLLAMA_API_KEY;
  return new Ollama3Provider(baseUrl, planModel, apiKey);
}

/** Plan uses lightweight base model — avoids orion-ai Modelfile system (~3k tokens). */
export async function generatePlanWithOllama(
  contextHistory: string,
  options?: { regenerate?: boolean; locale?: Locale }
): Promise<string> {
  const provider = getPlanOllamaProvider();
  const response = await withOllamaInference(() =>
    provider.generatePlan(contextHistory, options)
  );
  if (!response?.trim()) {
    throw new Error("Ollama returned an empty plan response");
  }
  return response;
}

export { clearPromptCache } from "./prompts.js";
