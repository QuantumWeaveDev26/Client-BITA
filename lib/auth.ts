import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// For every office page: the logged-in user and their BITA person record.
// Not logged in: go to /login. Logged in but not set up as BITA staff: person is null.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase
    .from("people")
    .select("id, full_name, roles")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, person };
}
