import * as SecureStore from "expo-secure-store";

import { CHUNK_SIZE, secureStoreAdapter } from "./supabase";

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

describe("secureStoreAdapter", () => {
  beforeEach(() => store.clear());

  it("round-trips a small value without chunking", async () => {
    await secureStoreAdapter.setItem("sb-local-auth-token", "small");
    expect(await secureStoreAdapter.getItem("sb-local-auth-token")).toBe("small");
    expect(store.size).toBe(1);
  });

  it("chunks values larger than the SecureStore limit and reassembles them", async () => {
    const session = JSON.stringify({ access_token: "a".repeat(CHUNK_SIZE * 2 + 100) });
    await secureStoreAdapter.setItem("sb-local-auth-token", session);

    for (const value of store.values()) expect(value.length).toBeLessThanOrEqual(2048);
    expect(await secureStoreAdapter.getItem("sb-local-auth-token")).toBe(session);
  });

  it("removes stale chunks when a session shrinks and on sign-out", async () => {
    await secureStoreAdapter.setItem("k", "b".repeat(CHUNK_SIZE * 3));
    await secureStoreAdapter.setItem("k", "short");
    expect([...store.keys()]).toEqual(["k"]);

    await secureStoreAdapter.removeItem("k");
    expect(store.size).toBe(0);
    expect(await secureStoreAdapter.getItem("k")).toBeNull();
  });
});
