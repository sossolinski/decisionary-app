import "server-only";

import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function createSupabaseAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseAnonServerClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(authHeader?: string | null) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function requireAdminUserFromBearer(authHeader?: string | null) {
  const token = getBearerToken(authHeader);
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const publicClient = createSupabaseAnonServerClient();
  const adminClient = createSupabaseAdminClient();

  const {
    data: { user },
    error: userError,
  } = await publicClient.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Invalid session");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("user_id, role, is_disabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.is_disabled || profile.role !== "admin") {
    throw new Error("Admin access required");
  }

  return { user, adminClient };
}
