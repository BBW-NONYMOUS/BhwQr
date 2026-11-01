import { corsHeaders } from "./cors.ts";
import { ERROR_CATALOG, type ErrorCode } from "./error-codes.generated.ts";

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Error response in the shared format { ok:false, code, message, params } with the catalog HTTP status. */
export function fail(
  req: Request,
  code: string,
  params: Record<string, string | number> = {},
): Response {
  const entry = (ERROR_CATALOG as Record<string, { http: number | null; en: string }>)[code] ??
    ERROR_CATALOG.INTERNAL_ERROR;
  const message = entry.en.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
  return json(req, { ok: false, code, message, params }, entry.http ?? 400);
}

export function isErrorCode(code: string): code is ErrorCode {
  return code in ERROR_CATALOG;
}

/** Maps a Postgres exception raised by an RPC (message = catalog code) to a response. */
export function failFromDb(req: Request, error: { message?: string } | null): Response {
  const code = error?.message?.trim() ?? "";
  return fail(req, isErrorCode(code) ? code : "INTERNAL_ERROR");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
