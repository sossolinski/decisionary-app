#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env.local");
const migrationPath = path.join(cwd, "supabase", "migrations", "202604110003_billing_and_session_modes.sql");

const requiredEnvNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return new Map();

  const raw = fs.readFileSync(filePath, "utf8");
  const map = new Map();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    map.set(key, value);
  }

  return map;
}

const localEnv = loadEnvFile(envPath);

let hasProblem = false;

console.log("Decisionary billing doctor\n");

console.log(`- .env.local: ${fs.existsSync(envPath) ? "found" : "missing"}`);
console.log(`- billing migration: ${fs.existsSync(migrationPath) ? "found" : "missing"}`);

for (const name of requiredEnvNames) {
  const fromProcess = process.env[name];
  const fromFile = localEnv.get(name);
  const value = fromProcess ?? fromFile ?? "";
  const present = Boolean(value);
  console.log(`- ${name}: ${present ? "present" : "missing"}`);
  if (!present) hasProblem = true;
}

console.log("");

if (hasProblem) {
  console.log("Next step:");
  console.log("- fill missing env values");
  console.log("- run `npm run supabase:reset` if billing RPCs are missing locally");
  console.log("- run `stripe listen --forward-to localhost:3000/api/stripe/webhook` for webhook testing");
  process.exitCode = 1;
} else {
  console.log("Billing setup looks ready for a local smoke test.");
}
