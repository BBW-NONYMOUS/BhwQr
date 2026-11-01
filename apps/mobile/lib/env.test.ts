import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a LAN Supabase URL and an anon key", () => {
    const env = parseEnv({
      EXPO_PUBLIC_SUPABASE_URL: "http://192.168.1.10:54321",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.public-anon",
    });
    expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe("http://192.168.1.10:54321");
  });

  it("rejects a missing anon key with a helpful message", () => {
    expect(() =>
      parseEnv({ EXPO_PUBLIC_SUPABASE_URL: "http://192.168.1.10:54321", EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined }),
    ).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("rejects a value that is not a URL", () => {
    expect(() =>
      parseEnv({ EXPO_PUBLIC_SUPABASE_URL: "localhost", EXPO_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40) }),
    ).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });
});
