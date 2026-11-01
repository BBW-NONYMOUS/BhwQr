// Runs supabase/tests/database/*.test.sql against a Postgres database without Docker
// (`supabase test db` needs Docker for pg_prove). Used for the hosted dev/staging project.
//
// Connection string: env DATABASE_URL, or a line DATABASE_URL=... in supabase/.env.test.local
// (git-ignored). Use the Session pooler URL from Project Settings > Database. Never commit it.
//
//   node scripts/run-pgtap.mjs            # all files
//   node scripts/run-pgtap.mjs 02         # files whose name contains "02"
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, "supabase/.env.test.local");

let url = process.env.DATABASE_URL;
if (!url && existsSync(envFile)) {
  const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  url = line?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}
if (!url) {
  console.error("DATABASE_URL is not set (env or supabase/.env.test.local).");
  process.exit(2);
}

const dir = join(root, "supabase/tests/database");
const filter = process.argv[2];
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.sql") && (!filter || f.includes(filter) || f.startsWith("00_")))
  .sort();

// Hosted Supabase certificates are signed by Supabase's own CA. Download it from
// Project Settings > Database > SSL Configuration and save it as supabase/prod-ca-2021.crt.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const caPath = join(root, "supabase/prod-ca-2021.crt");
if (!isLocal && !existsSync(caPath)) {
  console.error("Missing supabase/prod-ca-2021.crt (Project Settings > Database > SSL Configuration > Download certificate).");
  process.exit(2);
}
const client = new pg.Client({
  connectionString: url.replace(/[?&]sslmode=[^&]*/, ""),
  ssl: isLocal ? false : { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true },
});
await client.connect();
await client.query("create extension if not exists pgtap with schema extensions");
await client.query("set search_path to public, extensions");

let failed = 0;
let passed = 0;
for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  console.log(`\n# ${file}`);
  try {
    const results = await client.query(`set search_path to public, extensions;\n${sql}`);
    const lines = (Array.isArray(results) ? results : [results])
      .flatMap((r) => r.rows ?? [])
      .flatMap((row) => Object.values(row))
      .filter((v) => typeof v === "string")
      .flatMap((v) => v.split("\n"));
    for (const line of lines) {
      if (/^ok \d+/.test(line)) passed += 1;
      if (/^not ok \d+/.test(line)) failed += 1;
      if (/^(ok|not ok|#|1\.\.)/.test(line.trim())) console.log(line);
    }
  } catch (e) {
    failed += 1;
    console.log(`not ok - ${file} aborted: ${e.message}`);
    await client.query("rollback").catch(() => {});
  }
}
await client.end();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
