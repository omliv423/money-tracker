#!/usr/bin/env npx tsx

/**
 * Usage monitoring script for Supabase
 * Run: npx tsx scripts/check-usage.ts
 *
 * For automated monitoring, add to cron:
 * 0 9 * * * cd /path/to/money-tracker && npx tsx scripts/check-usage.ts
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envFile = readFileSync(".env.local", "utf-8");
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    console.error("Could not load .env.local");
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Free tier limits
const LIMITS = {
  DATABASE_SIZE_MB: 500,
  MONTHLY_ACTIVE_USERS: 50000,
  STORAGE_GB: 1,
  ALERT_THRESHOLD: 0.7, // Alert at 70% usage
};

async function checkUsage() {
  console.log("=== Money Tracker Usage Report ===\n");
  console.log(`Date: ${new Date().toLocaleString("ja-JP")}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check user count
  const { count: userCount } = await supabase
    .from("app_users")
    .select("*", { count: "exact", head: true });

  console.log(`Users: ${userCount ?? 0}`);

  // Check transaction count
  const { count: txCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });

  console.log(`Transactions: ${txCount ?? 0}`);

  // Check account count
  const { count: accountCount } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true });

  console.log(`Accounts: ${accountCount ?? 0}`);

  // Estimate database size (rough calculation)
  // Average transaction ~500 bytes, account ~200 bytes, user ~300 bytes
  const estimatedSizeMB =
    ((txCount ?? 0) * 500 + (accountCount ?? 0) * 200 + (userCount ?? 0) * 300) /
    1024 /
    1024;

  const usagePercent = (estimatedSizeMB / LIMITS.DATABASE_SIZE_MB) * 100;

  console.log(`\nEstimated DB Size: ${estimatedSizeMB.toFixed(2)} MB / ${LIMITS.DATABASE_SIZE_MB} MB`);
  console.log(`Usage: ${usagePercent.toFixed(1)}%`);

  // Warnings
  console.log("\n--- Alerts ---");

  if (usagePercent > LIMITS.ALERT_THRESHOLD * 100) {
    console.log(`⚠️  WARNING: Database usage at ${usagePercent.toFixed(1)}%`);
    console.log("   Consider upgrading to Supabase Pro ($25/month)");
  } else if (usagePercent > 50) {
    console.log(`📊 Database usage is moderate (${usagePercent.toFixed(1)}%)`);
  } else {
    console.log("✅ All systems within normal limits");
  }

  // Recommendations based on user count
  console.log("\n--- Recommendations ---");

  if ((userCount ?? 0) > 300) {
    console.log("📈 User count > 300: Start monitoring Supabase dashboard weekly");
  }
  if ((userCount ?? 0) > 500) {
    console.log("💳 User count > 500: Consider upgrading to Supabase Pro");
  }
  if ((userCount ?? 0) > 1000) {
    console.log("🚀 User count > 1000: Upgrade to Vercel Pro recommended");
  }

  console.log("\n--- Manual Checks Required ---");
  console.log("1. Vercel: https://vercel.com/dashboard → Usage");
  console.log("2. Supabase: https://supabase.com/dashboard → Project → Settings → Usage");
  console.log("3. Stripe: https://dashboard.stripe.com → Balances");
}

checkUsage().catch(console.error);
