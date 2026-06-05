import { Ollama3Provider } from "./ollama3.js";
import { getSystemInstruction, useOllamaModelfile } from "./prompts.js";
import { withOllamaInference } from "../../lib/ollama-queue.js";
import {
  resolveOllamaChatModel,
  resolveOllamaPlanModel,
} from "../../lib/ollama-model-env.js";

async function resolveChatSystemInstruction(): Promise<string> {
  if (useOllamaModelfile()) {
    return "";
  }
  return getSystemInstruction();
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
  history: Array<{ role: string; parts: Array<{ text: string }> }>
): Promise<string> {
  const provider = getOllamaProvider();
  const systemInstruction = await resolveChatSystemInstruction();
  const response = await withOllamaInference(() =>
    provider.sendMessage(message, history, systemInstruction)
  );
  if (!response?.trim()) {
    throw new Error("Ollama returned an empty response");
  }
  return response;
}

export async function sendMessageStreamWithOllama(
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  onChunk: (chunk: string) => void
): Promise<string> {
  const provider = getOllamaProvider();
  const systemInstruction = await resolveChatSystemInstruction();
  const response = await withOllamaInference(() =>
    provider.sendMessageStream(message, history, systemInstruction, onChunk)
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
  options?: { regenerate?: boolean }
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
