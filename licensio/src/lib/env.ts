import { z } from "zod";

// Variables serveur, validées au premier accès pour échouer tôt et clairement.
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_BUCKET_LICENSES: z.string().default("license-documents"),
  SUPABASE_BUCKET_MEDIA: z.string().default("project-media"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Facturation (facultatif : sans ces variables, l'app fonctionne en plan gratuit seul).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_CREATOR: z.string().optional(),
  STRIPE_PRICE_AGENCY: z.string().optional(),
  // "true" : TVA calculée par Stripe Tax (à activer dans le tableau de bord Stripe).
  STRIPE_TAX_ENABLED: z.string().optional(),
  // Autre point d'accès API (stripe-mock, tests) ; vide = API Stripe officielle.
  STRIPE_API_BASE: z.string().url().optional(),
  // Emails d'invitation (facultatif : sans clé, le lien est à transmettre à la main).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // ex. "Licensio <invitations@votre-domaine.com>"
  RESEND_API_BASE: z.string().url().optional(),
  // Secret des tâches planifiées (nettoyage des fichiers orphelins).
  CRON_SECRET: z.string().optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
