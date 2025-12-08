// Helper para detectar plataforma e retornar endpoint correto
export function getApiEndpoint(path: string): string {
  if (typeof window === "undefined") {
    // Server-side: usar /api (Vercel)
    return `/api/${path}`;
  }

  const hostname = window.location.hostname;
  const isVercel =
    hostname.includes("vercel.app") || hostname.includes("vercel.com");
  const isNetlify =
    hostname.includes("netlify.app") || hostname.includes("netlify.com");
  const isDev = hostname === "localhost" || hostname === "127.0.0.1";

  if (isVercel) {
    return `/api/${path}`;
  } else if (isNetlify || isDev) {
    return `/.netlify/functions/${path}`;
  }

  // Default para Vercel
  return `/api/${path}`;
}
