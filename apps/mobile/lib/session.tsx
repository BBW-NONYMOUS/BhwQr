import type { Session } from "@supabase/supabase-js";
import type { Tables } from "@bhw/types";
import { useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { callFunction } from "./api";
import { getInstallationId } from "./device-id";
import { clearOfflineSnapshots } from "./queries/history";
import { getSupabase } from "./supabase";

export type Profile = Pick<
  Tables<"profiles">,
  "id" | "full_name" | "bhw_id_number" | "area" | "email" | "role" | "status" | "rejection_reason" | "photo_url"
>;

/**
 * Where the auth guard sends the user (core flow 2):
 *  loading → splash; signed_out → Login; blocked → Blocked (status / wrong role / other phone);
 *  needs_binding → Bind Device; ready → tabs.
 */
export type Gate =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "blocked"; reason: "pending" | "rejected" | "inactive" | "not_employee" | "device_mismatch"; detail?: string | null }
  | { kind: "needs_binding" }
  | { kind: "ready" };

interface SessionContext {
  session: Session | null;
  profile: Profile | null;
  gate: Gate;
  deviceId: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  bindThisPhone: () => Promise<{ ok: true } | { ok: false; code: string }>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionContext | null>(null);

/** Last profile seen online, so a signed-in employee who opens the app offline is not sent to Login. */
const PROFILE_CACHE_KEY = "bhw.last-profile";
async function readCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as Profile) : null;
    return cached?.id === userId ? cached : null;
  } catch {
    return null;
  }
}

export function decideGate(profile: Profile | null, hasActiveDevice: boolean, deviceCheck: "ok" | "mismatch" | null): Gate {
  if (!profile) return { kind: "signed_out" };
  if (profile.role !== "employee") return { kind: "blocked", reason: "not_employee" };
  if (profile.status === "pending") return { kind: "blocked", reason: "pending" };
  if (profile.status === "rejected") return { kind: "blocked", reason: "rejected", detail: profile.rejection_reason };
  if (profile.status === "inactive") return { kind: "blocked", reason: "inactive" };
  if (!hasActiveDevice) return { kind: "needs_binding" };
  if (deviceCheck === "mismatch") return { kind: "blocked", reason: "device_mismatch" };
  return { kind: "ready" };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const evaluateRef = React.useRef<((s: Session | null) => Promise<void>) | null>(null);
  const evaluate = useCallback(
    async (s: Session | null) => {
      if (!s) {
        setProfile(null);
        setGate({ kind: "signed_out" });
        return;
      }
      const { data: fetched, error } = await supabase
        .from("profiles")
        .select("id, full_name, bhw_id_number, area, email, role, status, rejection_reason, photo_url")
        .eq("id", s.user.id)
        .maybeSingle();
      // A failed request (offline) is not "no profile": fall back to the last profile seen online.
      // Scanning still re-checks status and device on the server, so this only allows cached viewing.
      const p = error ? await readCachedProfile(s.user.id) : fetched;
      if (!error && fetched) {
        void SecureStore.setItemAsync(PROFILE_CACHE_KEY, JSON.stringify(fetched)).catch(() => undefined);
      }
      if (error && !p) {
        // First launch while offline: nothing cached yet. Keep the spinner (the offline Snackbar
        // explains why) and try again shortly; the gate settles as soon as the network returns.
        setGate({ kind: "loading" });
        setTimeout(() => void evaluateRef.current?.(s), 5000);
        return;
      }
      setProfile(p);
      if (!p || p.role !== "employee" || p.status !== "active") {
        setGate(decideGate(p, false, null));
        return;
      }
      const { count } = await supabase
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", s.user.id)
        .is("revoked_at", null);
      if (!count) {
        setGate({ kind: "needs_binding" });
        return;
      }
      // Confirm this installation is the bound phone (bind-device answers alreadyBound or DEVICE_MISMATCH).
      const id = await getInstallationId();
      const res = await callFunction<{ alreadyBound: boolean }>("bind-device", {
        deviceId: id,
        platform: Platform.OS === "ios" ? "ios" : "android",
        model: Device.modelName ?? null,
        appVersion: Application.nativeApplicationVersion ?? "dev",
      });
      if (!res.ok && res.code === "OFFLINE") {
        // Offline at launch: let the user view cached data; scanning re-checks the device anyway.
        setGate({ kind: "ready" });
        return;
      }
      setGate(decideGate(p, true, res.ok ? "ok" : "mismatch"));
    },
    [supabase],
  );
  useEffect(() => {
    evaluateRef.current = evaluate;
  }, [evaluate]);

  useEffect(() => {
    void getInstallationId().then(setDeviceId);
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void evaluate(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void evaluate(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, evaluate]);

  const value = useMemo<SessionContext>(
    () => ({
      session,
      profile,
      gate,
      deviceId,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        return error ? { ok: false, message: error.message } : { ok: true };
      },
      signOut: async () => {
        // Personal data must not stay on the phone after logout (RA 10173): cached queries,
        // offline snapshots and the cached profile are cleared from every logout path.
        await supabase.auth.signOut();
        queryClient.clear();
        clearOfflineSnapshots();
        await SecureStore.deleteItemAsync(PROFILE_CACHE_KEY).catch(() => undefined);
      },
      bindThisPhone: async () => {
        const id = deviceId ?? (await getInstallationId());
        const res = await callFunction<{ alreadyBound: boolean }>("bind-device", {
          deviceId: id,
          platform: Platform.OS === "ios" ? "ios" : "android",
          model: Device.modelName ?? null,
          appVersion: Application.nativeApplicationVersion ?? "dev",
        });
        if (res.ok) await evaluate(session);
        else if (res.code === "DEVICE_MISMATCH") setGate({ kind: "blocked", reason: "device_mismatch" });
        return res.ok ? { ok: true } : { ok: false, code: res.code };
      },
      refresh: () => evaluate(session),
    }),
    [session, profile, gate, deviceId, supabase, evaluate, queryClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
