"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Enums } from "@/lib/db/types";
import { friendlyError, text } from "@/lib/forms";

export async function createEnquiry(fd: FormData) {
  const { supabase } = await requireUser();
  const customerId = text(fd, "customer_id");
  const receivedAt = text(fd, "received_at");
  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      source: (text(fd, "source") ?? "phone") as Enums<"enquiry_source">,
      from_name: text(fd, "from_name"),
      from_address: text(fd, "from_address"),
      subject: text(fd, "subject"),
      body: text(fd, "body"),
      customer_id: customerId,
      status: customerId ? "linked" : "new",
      ...(receivedAt ? { received_at: new Date(receivedAt).toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error) redirect("/enquiries/new?error=" + encodeURIComponent(friendlyError(error.message)));
  redirect(`/enquiries/${data.id}`);
}

export async function linkCustomer(enquiryId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const customerId = text(fd, "customer_id");
  const { error } = await supabase
    .from("enquiries")
    .update({ customer_id: customerId, ...(customerId ? { status: "linked" as const } : {}) })
    .eq("id", enquiryId);
  if (error) redirect(`/enquiries/${enquiryId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/enquiries/${enquiryId}`);
}

export async function setStatus(enquiryId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("enquiries")
    .update({ status: text(fd, "status") as Enums<"enquiry_status"> })
    .eq("id", enquiryId);
  if (error) redirect(`/enquiries/${enquiryId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/enquiries/${enquiryId}`);
}
