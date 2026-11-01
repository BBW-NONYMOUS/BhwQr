import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@bhw/types";
import { publicEnv } from "@/lib/env";

/** Supabase client for Client Components. Uses the anon/publishable key; RLS applies. */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
