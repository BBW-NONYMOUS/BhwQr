import type { Database } from "@bhw/types";
import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

import { getEnv } from "./env";

/**
 * SecureStore-backed storage for the Supabase session.
 *
 * SecureStore (Keychain / Android Keystore) warns above ~2048 bytes per value and older
 * Android versions reject larger values, while a Supabase session JSON is usually bigger.
 * Values are therefore split into 1800-char chunks:
 *   <key>            -> "__chunks__:<n>"   (manifest)
 *   <key>.<i>        -> chunk i
 * Keys may only contain [A-Za-z0-9._-], so the Supabase key ("sb-<ref>-auth-token") is sanitised.
 */
export const CHUNK_SIZE = 1800;
const MANIFEST_PREFIX = "__chunks__:";

const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function removeChunks(key: string, from = 0): Promise<void> {
  // Delete trailing chunks until one is missing (handles a shrinking session too).
  for (let i = from; ; i++) {
    const chunkKey = `${key}.${i}`;
    const existing = await SecureStore.getItemAsync(chunkKey, secureOptions);
    if (existing === null) break;
    await SecureStore.deleteItemAsync(chunkKey, secureOptions);
  }
}

export const secureStoreAdapter: SupportedStorage = {
  async getItem(rawKey) {
    const key = safeKey(rawKey);
    const head = await SecureStore.getItemAsync(key, secureOptions);
    if (head === null || !head.startsWith(MANIFEST_PREFIX)) return head;
    const count = Number(head.slice(MANIFEST_PREFIX.length));
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`, secureOptions);
      if (part === null) return null; // corrupted / partially written -> treat as signed out
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(rawKey, value) {
    const key = safeKey(rawKey);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value, secureOptions);
      await removeChunks(key);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), secureOptions);
    }
    await removeChunks(key, count);
    await SecureStore.setItemAsync(key, `${MANIFEST_PREFIX}${count}`, secureOptions);
  },
  async removeItem(rawKey) {
    const key = safeKey(rawKey);
    await SecureStore.deleteItemAsync(key, secureOptions);
    await removeChunks(key);
  },
};

let client: SupabaseClient<Database> | undefined;

/**
 * Lazily-created Supabase client (so tests and screens that never touch the backend do not
 * require a .env). Typed with the Database generated from the hosted schema (@bhw/types).
 */
export function getSupabase() {
  if (!client) {
    const env = getEnv();
    client = createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === "web" ? undefined : secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    registerAutoRefresh(client);
  }
  return client;
}

/**
 * Supabase only refreshes tokens while the app is in the foreground on React Native.
 * Start the refresh timer when the app becomes active and stop it in the background.
 */
function registerAutoRefresh(c: SupabaseClient<Database>) {
  if (Platform.OS === "web") return;
  if (AppState.currentState === "active") void c.auth.startAutoRefresh();
  AppState.addEventListener("change", (state) => {
    if (state === "active") void c.auth.startAutoRefresh();
    else void c.auth.stopAutoRefresh();
  });
}
