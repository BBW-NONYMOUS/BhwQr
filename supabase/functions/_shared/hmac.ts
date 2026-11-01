// HMAC-SHA256 signing for kiosk and personal QR tokens (D-08, D-11, D-12) and device hashing (D-05).
// Token = PREFIX + base64url(JSON payload) + "." + base64url(HMAC(secret, base64url(JSON payload))).

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(data));
  return new Uint8Array(sig);
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const sig = await hmacSha256(secret, data);
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signToken(
  prefix: string,
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const sig = base64url(await hmacSha256(secret, body));
  return `${prefix}${body}.${sig}`;
}

export type VerifyResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: "format" | "signature" };

/**
 * Verifies a token against the current secret and, during rotation, the previous one.
 * Uses crypto.subtle.verify, which compares in constant time.
 */
export async function verifyToken<T>(
  prefix: string,
  content: string,
  secrets: string[],
): Promise<VerifyResult<T>> {
  const trimmed = content.trim();
  if (!trimmed.startsWith(prefix)) return { ok: false, reason: "format" };
  const [body, sig, extra] = trimmed.slice(prefix.length).split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "format" };
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) {
    return { ok: false, reason: "format" };
  }
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = base64urlDecode(sig);
  } catch {
    return { ok: false, reason: "format" };
  }
  for (const secret of secrets.filter(Boolean)) {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      sigBytes,
      encoder.encode(body),
    );
    if (valid) {
      try {
        return { ok: true, payload: JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as T };
      } catch {
        return { ok: false, reason: "format" };
      }
    }
  }
  return { ok: false, reason: "signature" };
}

export function requireSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret ${name}`);
  return value;
}

export function secretsWithPrevious(name: string): string[] {
  return [requireSecret(name), Deno.env.get(`${name}_PREVIOUS`) ?? ""].filter(Boolean);
}

/** device_id_hash = HMAC-SHA256(DEVICE_HASH_PEPPER, raw installation id), hex (D-05). */
export async function hashDeviceId(rawDeviceId: string): Promise<string> {
  return await hmacHex(requireSecret("DEVICE_HASH_PEPPER"), rawDeviceId.toLowerCase());
}
