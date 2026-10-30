import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Couleurs de statut de conformité
        compliant: { DEFAULT: "#16a34a", soft: "#dcfce7" },
        risk: { DEFAULT: "#dc2626", soft: "#fee2e2" },
        pending: { DEFAULT: "#a16207", soft: "#fef9c3" },
      },
    },
  },
  plugins: [],
} satisfies Config;
