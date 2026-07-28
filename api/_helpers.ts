import type { VercelRequest, VercelResponse } from "@vercel/node";

// Helper para configurar CORS
export function setCorsHeaders(
  res: VercelResponse,
  methods: string = "GET, POST, PUT, DELETE, OPTIONS"
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // X-Locale carrega o idioma ativo do cliente; X-Stream ativa SSE no /api/gemini.
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Locale, X-Stream"
  );
  res.setHeader("Access-Control-Allow-Methods", methods);
}

// Helper para lidar com OPTIONS (preflight)
export function handleOptions(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  return res.status(200).end();
}

// Helper para extrair token do header
export function getTokenFromHeader(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}
