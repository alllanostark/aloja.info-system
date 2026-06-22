import type { NextConfig } from "next";

// CSP moderado: protege contra clickjacking (frame-ancestors), plugins
// (object-src) e base-uri injection, mas mantém-se permissivo em script/img/
// connect (https:) para não quebrar o Maps SDK, o Supabase nem as fotos de
// imóveis (domínios de scraping variados). 'unsafe-inline'/'unsafe-eval' são
// exigidos pelo Next e pelo Google Maps JS.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  // Nota: o aviso "inferred workspace root" (múltiplos lockfiles) é cosmético
  // e não afeta o funcionamento. Não definimos turbopack.root porque interfere
  // com a deteção automática de conteúdo do Tailwind v4.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
