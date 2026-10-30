import type { NextConfig } from "next";

// Les fichiers (preuves de licence) ne passent pas par les Server Actions : le navigateur
// les envoie directement à Supabase Storage via une URL signée. La limite par défaut
// des Server Actions (1 Mo) suffit donc.
const nextConfig: NextConfig = {};

export default nextConfig;
