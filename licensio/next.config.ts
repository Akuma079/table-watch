import type { NextConfig } from "next";

// En-têtes de sécurité communs. SAMEORIGIN (et non DENY) : l'aperçu des preuves PDF
// s'affiche dans un iframe de l'application.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Chargés par Node à l'exécution plutôt qu'embarqués par webpack (BullMQ référence des
  // dépendances optionnelles, comme @valkey/valkey-glide, qui ne sont pas installées).
  serverExternalPackages: ["bullmq", "ioredis", "@react-pdf/renderer"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Le jeton du passeport est dans l'URL : il ne doit fuiter vers aucun site.
      { source: "/passport/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
