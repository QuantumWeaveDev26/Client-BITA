"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { checked, friendlyError, text } from "@/lib/forms";

function customerFields(fd: FormData) {
  return {
    name: text(fd, "name") ?? "",
    code: text(fd, "code")?.toUpperCase() ?? null,
    gstin: text(fd, "gstin")?.toUpperCase() ?? null,
    billing_address: text(fd, "billing_address"),
    uses_proforma: checked(fd, "uses_proforma"),
    payment_terms_days: Number(text(fd, "payment_terms_days") ?? 30),
    mailbox: text(fd, "mailbox"),
    notes: text(fd, "notes"),
  };
}

export async function createCustomer(fd: FormData) {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("customers").insert(customerFields(fd)).select("id").single();
  if (error) redirect("/customers/new?error=" + encodeURIComponent(friendlyError(error.message)));
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, fd: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("customers").update(customerFields(fd)).eq("id", id);
  if (error) redirect(`/customers/${id}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?saved=1`);
}

function contactFields(fd: FormData) {
  return {
    name: text(fd, "name") ?? "",
    mobile: text(fd, "mobile"),
    email: text(fd, "email"),
    notes: text(fd, "notes"),
    receives_reports: checked(fd, "receives_reports"),
    receives_invoices: checked(fd, "receives_invoices"),
  };
}

export async function addContact(customerId: string, fd: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("customer_contacts").insert({ customer_id: customerId, ...contactFields(fd) });
  if (error) redirect(`/customers/${customerId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/customers/${customerId}`);
}

export async function updateContact(customerId: string, contactId: string, fd: FormData) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("customer_contacts").update(contactFields(fd)).eq("id", contactId);
  if (error) redirect(`/customers/${customerId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteContact(customerId: string, contactId: string) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId);
  if (error) redirect(`/customers/${customerId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/customers/${customerId}`);
}
