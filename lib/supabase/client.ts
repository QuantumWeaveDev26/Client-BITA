import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";

// Supabase client for Client Components. Runs as the logged-in user, so Row Level Security applies.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
