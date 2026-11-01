import { z } from "zod";

/**
 * Public runtime config. EXPO_PUBLIC_* variables are inlined into the JS bundle at build time,
 * so they are NOT secret: never put the service-role key or HMAC secrets here.
 *
 * Expo only inlines `process.env.EXPO_PUBLIC_X` when it is written out literally,
 * so each variable is read explicitly below (no dynamic `process.env[name]`).
 */
export const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .url({ message: "EXPO_PUBLIC_SUPABASE_URL must be a URL, e.g. http://192.168.1.10:54321" })
    .refine((u) => /^https?:\/\//.test(u), "EXPO_PUBLIC_SUPABASE_URL must start with http:// or https://"),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or too short"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid mobile environment. Copy apps/mobile/.env.example to .env and fill it in.\n${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated env, parsed lazily so a missing .env fails loudly at first use, not at import time. */
export function getEnv(): Env {
  cached ??= parseEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cached;
}
