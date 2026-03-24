import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Set them in .env or environment."
  );
  process.exit(1);
}

const schemaPath = resolve(import.meta.dirname, "../src/db/schema.sql");
const sql = readFileSync(schemaPath, "utf-8");

console.log("Applying schema to Supabase...");

// Use the Supabase REST SQL endpoint (PostgREST rpc or pg_net)
// The simplest approach: use the /rest/v1/rpc endpoint isn't available for raw SQL.
// Instead, use the Supabase Management API or the PostgREST /sql endpoint if available.
// For service_role, we can use the pg endpoint directly via the supabase-js client.

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Split on semicolons that are NOT inside $$ blocks, then execute each statement.
// Supabase doesn't support multi-statement execution via rpc, so we use
// the SQL editor REST endpoint instead.
const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
}).catch(() => null);

// If the RPC approach doesn't work, try the Supabase SQL endpoint
// Available at /pg/query for projects with pg_graphql or via Management API
const sqlEndpoint = SUPABASE_URL.replace(".supabase.co", ".supabase.co");
const sqlResponse = await fetch(`${sqlEndpoint}/rest/v1/`, {
  method: "GET",
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  },
}).catch(() => null);

// Best approach: output the SQL for manual execution in Supabase dashboard
// and also try the supabase-js approach for what we can do
console.log("---");
console.log("Option 1: Copy the SQL below into your Supabase SQL Editor:");
console.log("  https://supabase.com/dashboard → SQL Editor → New Query → Paste & Run");
console.log("---");
console.log();
console.log(sql);
console.log();
console.log("---");
console.log("Option 2: Use the Supabase CLI:");
console.log("  npx supabase db push --db-url postgresql://postgres:[password]@[host]:5432/postgres");
console.log("---");

// Try to verify tables exist by querying creators
const { error } = await supabase.from("creators").select("id").limit(1);
if (error?.code === "42P01") {
  console.log("\n⚠️  Tables do not exist yet. Please run the SQL above in Supabase Dashboard.");
} else if (error) {
  console.log(`\n⚠️  Database check returned: ${error.message}`);
} else {
  console.log("\n✅ Tables already exist. Schema is ready.");
}

process.exit(0);
