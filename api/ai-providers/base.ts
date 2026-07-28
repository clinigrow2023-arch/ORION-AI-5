import type { Locale } from "../../lib/locale.js";

// Base interface for AI providers
export interface AIProvider {
  name: string;
  /** `locale` decides the answer language, whatever language the prompt is in. */
  sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string,
    locale?: Locale
  ): Promise<string>;
  /** `locale` applies to the JSON string values only; keys stay in English. */
  generatePlan(
    contextHistory: string,
    options?: { regenerate?: boolean; locale?: Locale }
  ): Promise<string>;
}

export interface AIProviderError extends Error {
  provider: string;
  code?: string | number;
  retryable: boolean; // Se true, pode tentar outro provider
}

// Helper to create provider errors
export function createProviderError(
  provider: string,
  message: string,
  code?: string | number,
  retryable: boolean = true
): AIProviderError {
  const error = new Error(message) as AIProviderError;
  error.provider = provider;
  error.code = code;
  error.retryable = retryable;
  return error;
}

// Check if error is retryable (rate limit, quota, etc.)
export function isRetryableError(error: any): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return error.retryable;
  }

  // Common retryable error patterns
  // 403 pode ser rate limit, quota ou outro problema temporário
  // Só não é retryable se for claramente "invalid api key" ou "unauthorized"
  const retryablePatterns = [
    "rate limit",
    "quota",
    "429",
    "403", // Pode ser rate limit ou quota em alguns providers
    "503",
    "500",
    "timeout",
    "network",
    "ECONNRESET",
    "ETIMEDOUT",
  ];

  // Erros não retryable (autenticação inválida)
  const nonRetryablePatterns = [
    "invalid api key",
    "unauthorized",
    "authentication failed",
    "invalid authentication",
  ];

  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code?.toString() || error?.status?.toString() || "";

  // Se for claramente um erro de autenticação, não é retryable
  if (nonRetryablePatterns.some((pattern) => errorMessage.includes(pattern))) {
    return false;
  }

  // Verificar se é um erro retryable
  return retryablePatterns.some(
    (pattern) => errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
}
