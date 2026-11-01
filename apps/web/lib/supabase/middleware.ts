import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

export interface SessionResult {
  response: NextResponse;
  user: User | null;
  /** Request-scoped client (user JWT), reused by the proxy for the profile lookup. */
  supabase: SupabaseClient;
}

/**
 * Refreshes the Supabase auth session for the incoming request and forwards the refreshed
 * cookies to both the request (for Server Components) and the response (for the browser).
 * Return the `response` object as-is (or copy its cookies) so the session stays in sync.
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(): getUser() revalidates the
  // token with Supabase Auth and triggers the cookie refresh above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
