import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. `server-only` makes any client-component import of this file a build error.
 * NEVER prefix these with NEXT_PUBLIC_.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY (service role / secret key) is required on the server"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const result = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!result.success) {
    const details = result.error.issues.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(`Invalid server environment variables.\n${details}`);
  }
  cached = result.data;
  return cached;
}
