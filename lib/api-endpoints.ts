// Helper para detectar plataforma e retornar endpoint correto
export function getApiEndpoint(path: string): string {
  // Sempre usar /api/ (Vercel e desenvolvimento local)
  return `/api/${path}`;
}
