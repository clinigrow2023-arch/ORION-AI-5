// Base interface for AI providers
export interface AIProvider {
  name: string;
  sendMessage(
    message: string,
    history: Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction: string
  ): Promise<string>;
  generatePlan(
    contextHistory: string,
    systemInstruction: string
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
  const retryablePatterns = [
    "rate limit",
    "quota",
    "429",
    "503",
    "500",
    "timeout",
    "network",
    "ECONNRESET",
    "ETIMEDOUT",
  ];

  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code?.toString() || error?.status?.toString() || "";

  return retryablePatterns.some(
    (pattern) => errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
}
