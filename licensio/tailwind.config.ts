import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Couleurs de statut de conformité
        compliant: { DEFAULT: "#16a34a", soft: "#dcfce7" },
        warning: { DEFAULT: "#f59e0b", soft: "#fef3c7" },
        risk: { DEFAULT: "#dc2626", soft: "#fee2e2" },
      },
    },
  },
  plugins: [],
} satisfies Config;
