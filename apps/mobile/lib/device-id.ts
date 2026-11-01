import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const KEY = "bhw.installation-id";

/**
 * Random installation ID created on first launch and kept in SecureStore (D-05). It is sent only
 * over TLS to bind-device / record-attendance, where the server stores HMAC(pepper, id) — the raw
 * value never leaves the phone otherwise. Reinstalling the app creates a new ID, which then needs
 * an admin device reset (D-07).
 */
export async function getInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  const id = randomUUID();
  await SecureStore.setItemAsync(KEY, id, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  return id;
}
