// Gives every demo BHW an illustrated profile photo (BR-12a) on a dev/staging project.
// Each avatar is drawn as SVG, rendered to PNG with Playwright's Chromium, then uploaded the way
// the web app does it: signed in as that BHW, into their own folder of `profile-photos`, and
// linked with set_my_photo. Accounts that already have a photo are skipped. Demo data only:
// never run against production.
//
//   node scripts/seed-demo-photos.mjs            (uses supabase/.temp/project-ref)
//   node scripts/seed-demo-photos.mjs --force    (replace existing demo photos too)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (!/^[a-z]{20}$/.test(ref)) throw new Error("Unexpected project ref in supabase/.temp/project-ref");
const raw = execSync(`npx supabase projects api-keys --project-ref ${ref} -o json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const keys = JSON.parse(raw.slice(raw.indexOf("[")));
const anon = keys.find((k) => k.name === "anon" || k.type === "publishable")?.api_key;
if (!anon) throw new Error("No anon/publishable key found for the project");
const url = `https://${ref}.supabase.co`;
const PASSWORD = "BhwDemo#2026";
const force = process.argv.includes("--force");

// Seeded demo BHWs (supabase/seed.sql) with a look for each illustration.
const BHWS = [
  { email: "maria.santos@bhw.local", skin: "#c68b59", hair: "#2b1d14", bg: "#0f766e", style: "bun" },
  { email: "rowena.delacruz@bhw.local", skin: "#d9a066", hair: "#1c1410", bg: "#7c3aed", style: "long" },
  { email: "norhaya.mamalinta@bhw.local", skin: "#b97a4f", hair: "#3f6212", bg: "#0369a1", style: "hijab" },
  { email: "josefina.villanueva@bhw.local", skin: "#e0ac7e", hair: "#6b7280", bg: "#be123c", style: "short" },
  { email: "analyn.garcia@bhw.local", skin: "#cf9461", hair: "#3b2416", bg: "#b45309", style: "long" },
  { email: "cristina.reyes@bhw.local", skin: "#a96f45", hair: "#1f1a17", bg: "#15803d", style: "bob" },
  { email: "fatima.abdullah@bhw.local", skin: "#c88a5a", hair: "#1e3a8a", bg: "#9333ea", style: "hijab" },
  { email: "lorna.bautista@bhw.local", skin: "#dba273", hair: "#4a2c1a", bg: "#0e7490", style: "bob" },
];

function avatarSvg({ skin, hair, bg, style }) {
  const back = {
    long: `<path d="M118 150c0-60 38-92 82-92s82 32 82 92v120H118z" fill="${hair}"/>`,
    bob: `<path d="M122 160c0-58 36-90 78-90s78 32 78 90v62H122z" fill="${hair}"/>`,
    bun: `<circle cx="200" cy="62" r="30" fill="${hair}"/>`,
    short: "",
    hijab: `<path d="M106 330c0-150 30-262 94-262s94 112 94 262z" fill="${hair}"/>`,
  }[style];
  const front = {
    long: `<path d="M134 150c8-46 34-68 66-68s58 22 66 68c-24-22-48-30-66-30s-42 8-66 30z" fill="${hair}"/>`,
    bob: `<path d="M134 152c6-46 32-70 66-70s60 24 66 70c-30-18-50-26-66-26s-36 8-66 26z" fill="${hair}"/>`,
    bun: `<path d="M138 146c6-40 30-62 62-62s56 22 62 62c-26-16-44-22-62-22s-36 6-62 22z" fill="${hair}"/>`,
    short: `<path d="M136 148c4-44 30-68 64-68s60 24 64 68c-20-24-42-32-64-32s-44 8-64 32z" fill="${hair}"/>`,
    hijab: `<path d="M140 132c10-30 32-46 60-46s50 16 60 46c-18-10-38-14-60-14s-42 4-60 14z" fill="${hair}" opacity=".9"/>`,
  }[style];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${bg}"/>
  <circle cx="200" cy="200" r="190" fill="#ffffff" opacity=".08"/>
  ${back}
  <path d="M70 400c8-78 62-118 130-118s122 40 130 118z" fill="#f8fafc"/>
  <path d="M170 282h60l-30 44z" fill="${skin}"/>
  <rect x="178" y="232" width="44" height="56" rx="18" fill="${skin}"/>
  <ellipse cx="200" cy="170" rx="62" ry="72" fill="${skin}"/>
  ${front}
  <circle cx="177" cy="176" r="6" fill="#1f2937"/><circle cx="223" cy="176" r="6" fill="#1f2937"/>
  <path d="M182 208c10 9 26 9 36 0" stroke="#7f1d1d" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M180 304h40v96h-40z" fill="#0f766e" opacity=".9"/>
  <rect x="226" y="320" width="56" height="34" rx="6" fill="#0f766e"/>
  <text x="254" y="343" font-family="Arial" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">BHW</text>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
let done = 0;
let skipped = 0;
try {
  for (const bhw of BHWS) {
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: signInError } = await client.auth.signInWithPassword({ email: bhw.email, password: PASSWORD });
    if (signInError) throw new Error(`${bhw.email}: ${signInError.message}`);
    const uid = auth.user.id;
    const { data: profile } = await client.from("profiles").select("full_name, photo_url").eq("id", uid).single();
    if (profile.photo_url && !force) {
      console.log(`skip   ${profile.full_name} (already has a photo)`);
      skipped += 1;
      continue;
    }

    await page.setContent(`<html><body style="margin:0">${avatarSvg(bhw)}</body></html>`);
    const png = await page.locator("svg").screenshot({ type: "png" });
    const path = `${uid}/photo-${Date.now()}.png`;
    const { error: uploadError } = await client.storage
      .from("profile-photos")
      .upload(path, png, { contentType: "image/png", upsert: false });
    if (uploadError) throw new Error(`${bhw.email}: upload ${uploadError.message}`);
    const { error: linkError } = await client.rpc("set_my_photo", { p_path: path });
    if (linkError) throw new Error(`${bhw.email}: set_my_photo ${linkError.message}`);
    console.log(`photo  ${profile.full_name}`);
    done += 1;
    await client.auth.signOut();
  }
} finally {
  await browser.close();
}
console.log(`\n${done} photos added, ${skipped} skipped`);
