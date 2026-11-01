import { NextResponse, type NextRequest } from "next/server";
import { decideRoute, type GuardProfile } from "@/lib/auth/guard";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 proxy (formerly middleware): refreshes the Supabase session on every page request
 * and applies the role/status rules of lib/auth/guard.ts. RLS and RPC guards remain the real
 * security boundary; this only routes people to the right page.
 */
const MAINTENANCE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance | BHW QR Attendance</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5"><h1>Under maintenance</h1><p>The BHW attendance portal is being restored and will be back shortly. Scans are not being recorded right now; the administrator will record today's attendance.</p><p lang="fil">Inaayos ang BHW attendance portal at babalik ito sa lalong madaling panahon. Hindi muna naitatala ang mga scan; ang administrator ang magtatala ng attendance ngayong araw.</p></body></html>`;

export async function proxy(request: NextRequest) {
  // Restore procedure switch (docs/phase-2-architecture/04-operations-and-security.md §2):
  // set MAINTENANCE=1 in the hosting environment to close the portal while the database is restored.
  if (process.env.MAINTENANCE === "1") {
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "600" },
    });
  }

  const { response, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  let profile: GuardProfile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
    profile = (data as GuardProfile | null) ?? null;
  }

  const decision = decideRoute(pathname, profile, user !== null);
  if (decision.action === "allow") return response;

  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // Every path except Next.js internals, image optimisation, metadata files and static assets.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
