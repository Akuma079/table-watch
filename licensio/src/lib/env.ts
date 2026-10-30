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
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
