import type { requireStaff } from "@/lib/auth";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

// Choices for the quotation form: customers and open enquiries.
export async function quotationFormOptions(supabase: Supabase) {
  const [{ data: customers }, { data: enquiries }] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase
      .from("enquiries")
      .select("id, subject, customers(name)")
      .neq("status", "closed")
      .order("received_at", { ascending: false })
      .limit(100),
  ]);
  return {
    customers: (customers ?? []).map((c) => ({ id: c.id, label: c.name })),
    enquiries: (enquiries ?? []).map((e) => ({
      id: e.id,
      label: `${e.subject ?? "(no subject)"}${e.customers ? " – " + e.customers.name : ""}`,
    })),
  };
}
