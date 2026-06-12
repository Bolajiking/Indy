import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Set them in .env or environment.",
  );
  process.exit(1);
}

const schemaPath = resolve(import.meta.dirname, "../src/db/schema.sql");
const sql = readFileSync(schemaPath, "utf-8");

console.log("Applying schema to Supabase...");

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log("---");
console.log("Option 1: Copy the SQL below into your Supabase SQL Editor:");
console.log(
  "  https://supabase.com/dashboard → SQL Editor → New Query → Paste & Run",
);
console.log("---");
console.log();
console.log(sql);
console.log();
console.log("---");
console.log("Option 2: Use the Supabase CLI:");
console.log(
  "  npx supabase db push --db-url postgresql://postgres:[password]@[host]:5432/postgres",
);
console.log("---");

const { error } = await supabase.from("creators").select("id").limit(1);
if (error?.code === "42P01") {
  console.log(
    "\n⚠️  Tables do not exist yet. Please run the SQL above in Supabase Dashboard.",
  );
} else if (error) {
  console.log(`\n⚠️  Database check returned: ${error.message}`);
} else {
  console.log("\n✅ Tables already exist. Schema is ready.");
}

process.exit(0);
