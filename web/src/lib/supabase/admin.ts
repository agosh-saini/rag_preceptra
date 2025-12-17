import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../env";

export function createSupabaseAdmin() {
  // Prefer server-only env var, but allow reuse of the public URL to reduce duplication.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set SUPABASE_URL (preferred) or NEXT_PUBLIC_SUPABASE_URL in web/.env.local"
    );
  }
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


