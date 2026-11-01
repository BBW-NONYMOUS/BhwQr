// Creates supabase/functions/.env with fresh random Edge Function secrets (D-05, D-08, D-12).
// Never overwrites an existing file: rotating QR keys is done with *_PREVIOUS (see
// docs/phase-2-architecture/04-operations-and-security.md §3), and changing DEVICE_HASH_PEPPER
// un-binds every phone. Values are not printed.
//
//   node scripts/gen-function-secrets.mjs
//   npx supabase secrets set --env-file supabase/functions/.env
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const file = "supabase/functions/.env";
if (existsSync(file)) {
  console.log(`${file} already exists – not overwritten.`);
  process.exit(0);
}
const secret = () => randomBytes(32).toString("base64");
const lines = [
  `QR_SIGNING_SECRET=${secret()}`,
  `PERSONAL_QR_SIGNING_SECRET=${secret()}`,
  `DEVICE_HASH_PEPPER=${secret()}`,
  `DEVICE_SYNC_API_KEY=${secret()}`,
  `NOTIFY_FROM_EMAIL="BHW Attendance <no-reply@example.com>"`,
  `APP_URL=http://localhost:3000`,
  `ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`,
];
writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
console.log(`Wrote ${file} with ${lines.length} values (git-ignored). Next:`);
console.log("  npx supabase secrets set --env-file supabase/functions/.env");
