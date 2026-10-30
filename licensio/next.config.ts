import type { NextConfig } from "next";

// Les fichiers (preuves de licence) ne passent pas par les Server Actions : le navigateur
// les envoie directement à Supabase Storage via une URL signée. La limite par défaut
// des Server Actions (1 Mo) suffit donc.
const nextConfig: NextConfig = {
  // Chargés par Node à l'exécution plutôt qu'embarqués par webpack (BullMQ référence des
  // dépendances optionnelles, comme @valkey/valkey-glide, qui ne sont pas installées).
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
