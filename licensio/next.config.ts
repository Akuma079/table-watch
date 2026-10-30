import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Les PDF de licence passent par les Server Actions : on relève la limite par défaut (1 Mo).
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
