import { Ollama3Provider } from "./ollama3.js";
import { getSystemInstruction } from "./prompts.js";

let ollamaProvider: Ollama3Provider | null = null;

function getOllamaProvider(): Ollama3Provider {
  if (!ollamaProvider) {
    const baseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const model = process.env.OLLAMA_MODEL || "llama3-8b-fast";
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
  const systemInstruction = await getSystemInstruction();
  const response = await provider.sendMessage(message, history, systemInstruction);
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
  const systemInstruction = await getSystemInstruction();
  const response = await provider.sendMessageStream(
    message,
    history,
    systemInstruction,
    onChunk
  );
  if (!response?.trim()) {
    throw new Error("Ollama returned an empty response");
  }
  return response;
}

export async function generatePlanWithOllama(
  contextHistory: string
): Promise<string> {
  const provider = getOllamaProvider();
  const systemInstruction = await getSystemInstruction();
  const response = await provider.generatePlan(contextHistory, systemInstruction);
  if (!response?.trim()) {
    throw new Error("Ollama returned an empty plan response");
  }
  return response;
}

export { clearPromptCache } from "./prompts.js";
