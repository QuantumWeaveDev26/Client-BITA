"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Constants, type Enums } from "@/lib/db/types";
import { friendlyError, text } from "@/lib/forms";
import { DEFAULT_QUOTATION_TERMS } from "./labels";

type Supabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

function num(fd: FormData, name: string): number | null {
  const raw = text(fd, name);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function quotationFields(fd: FormData) {
  return {
    ref_no: text(fd, "ref_no"),
    customer_id: text(fd, "customer_id") ?? "",
    enquiry_id: text(fd, "enquiry_id"),
    quote_date: text(fd, "quote_date") ?? new Date().toISOString().slice(0, 10),
    attention: text(fd, "attention"),
    subject: text(fd, "subject"),
    terms: text(fd, "terms") ?? DEFAULT_QUOTATION_TERMS,
  };
}

// Stores an uploaded signed quotation PDF in the private documents bucket and records its path.
async function saveQuotationPdf(supabase: Supabase, quotationId: string, fd: FormData): Promise<string | null> {
  const file = fd.get("pdf_file");
  if (!(file instanceof File) || file.size === 0) return null;
  const path = `quotations/${quotationId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
  if (error) return error.message;
  const { error: updateError } = await supabase.from("quotations").update({ pdf_path: path }).eq("id", quotationId);
  return updateError?.message ?? null;
}

export async function createQuotation(fd: FormData) {
  const { supabase } = await requireStaff();
  const fields = quotationFields(fd);
  if (!fields.customer_id) {
    redirect("/quotations/new?error=" + encodeURIComponent("Please choose a customer."));
  }

  const { data, error } = await supabase.from("quotations").insert(fields).select("id").single();
  if (error) redirect("/quotations/new?error=" + encodeURIComponent(friendlyError(error.message)));

  // Optional first item entered directly on the new quotation screen.
  const firstDesc = text(fd, "item_description");
  if (firstDesc) {
    await supabase.from("quotation_items").insert({
      quotation_id: data.id,
      position: 1,
      description: firstDesc,
      basis: text(fd, "item_basis"),
      rate: num(fd, "item_rate"),
      minimum_charge: num(fd, "item_minimum_charge"),
      notes: text(fd, "item_notes"),
    });
  }

  if (fields.enquiry_id) {
    await supabase
      .from("enquiries")
      .update({ status: "quoted" })
      .eq("id", fields.enquiry_id)
      .neq("status", "converted");
    revalidatePath(`/enquiries/${fields.enquiry_id}`);
    revalidatePath("/enquiries");
  }

  const fileError = await saveQuotationPdf(supabase, data.id, fd);
  redirect(
    `/quotations/${data.id}` +
      (fileError ? "?error=" + encodeURIComponent("Quotation saved, but PDF file was not: " + fileError) : ""),
  );
}

export async function updateQuotation(id: string, fd: FormData) {
  const { supabase, person } = await requireStaff();
  const statusRaw = text(fd, "status");
  const status =
    statusRaw && (Constants.public.Enums.quotation_status as readonly string[]).includes(statusRaw)
      ? (statusRaw as Enums<"quotation_status">)
      : null;

  const { data: existing } = await supabase
    .from("quotations")
    .select("status, approved_at, approved_by")
    .eq("id", id)
    .maybeSingle();

  let approvalPatch: { approved_by?: string | null; approved_at?: string | null } = {};
  if (status && ["approved", "sent", "accepted"].includes(status) && !existing?.approved_at) {
    if (!person || !person.roles.includes("management")) {
      redirect(`/quotations/${id}?error=` + encodeURIComponent("Only management can approve a quotation (R10)."));
    }
    approvalPatch = { approved_by: person.id, approved_at: new Date().toISOString() };
  } else if (status === "draft") {
    approvalPatch = { approved_by: null, approved_at: null };
  }

  const { error } = await supabase
    .from("quotations")
    .update({
      ...quotationFields(fd),
      ...(status ? { status } : {}),
      ...approvalPatch,
    })
    .eq("id", id);

  if (error) redirect(`/quotations/${id}?error=` + encodeURIComponent(friendlyError(error.message)));
  const fileError = await saveQuotationPdf(supabase, id, fd);
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  redirect(`/quotations/${id}` + (fileError ? "?error=" + encodeURIComponent("PDF file not saved: " + fileError) : "?saved=1"));
}

// R10: Only Anand Teertha or S. Radhakrishnan (management role) can approve and send a quotation.
export async function approveQuotation(id: string) {
  const { supabase, person } = await requireStaff();
  if (!person || !person.roles.includes("management")) {
    redirect(`/quotations/${id}?error=` + encodeURIComponent("Only management can approve a quotation (R10)."));
  }
  const { error } = await supabase
    .from("quotations")
    .update({
      status: "approved",
      approved_by: person.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect(`/quotations/${id}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  redirect(`/quotations/${id}?saved=approved`);
}

export async function setQuotationStatus(id: string, fd: FormData) {
  const { supabase, person } = await requireStaff();
  const statusRaw = text(fd, "status");
  if (!statusRaw || !(Constants.public.Enums.quotation_status as readonly string[]).includes(statusRaw)) {
    redirect(`/quotations/${id}`);
  }
  const status = statusRaw as Enums<"quotation_status">;

  const { data: existing } = await supabase
    .from("quotations")
    .select("approved_at, approved_by")
    .eq("id", id)
    .maybeSingle();

  let approvalPatch: { approved_by?: string | null; approved_at?: string | null } = {};
  if (["approved", "sent", "accepted"].includes(status) && !existing?.approved_at) {
    if (!person || !person.roles.includes("management")) {
      redirect(`/quotations/${id}?error=` + encodeURIComponent("Only management can approve a quotation (R10)."));
    }
    approvalPatch = { approved_by: person.id, approved_at: new Date().toISOString() };
  } else if (status === "draft") {
    approvalPatch = { approved_by: null, approved_at: null };
  }

  const { error } = await supabase
    .from("quotations")
    .update({ status, ...approvalPatch })
    .eq("id", id);

  if (error) redirect(`/quotations/${id}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  redirect(`/quotations/${id}?saved=1`);
}

// R11: Quotations have no expiry date. Management decides when a quotation is to be revised.
export async function reviseQuotation(id: string) {
  const { supabase, person } = await requireStaff();
  if (!person || !person.roles.includes("management")) {
    redirect(`/quotations/${id}?error=` + encodeURIComponent("Only management can revise a quotation (R11)."));
  }

  const { data: original } = await supabase
    .from("quotations")
    .select("*, quotation_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!original) redirect("/quotations");

  const { data: created, error } = await supabase
    .from("quotations")
    .insert({
      customer_id: original.customer_id,
      enquiry_id: original.enquiry_id,
      quote_date: new Date().toISOString().slice(0, 10),
      attention: original.attention,
      subject: original.subject,
      terms: original.terms ?? DEFAULT_QUOTATION_TERMS,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) redirect(`/quotations/${id}?error=` + encodeURIComponent(friendlyError(error.message)));

  if (original.quotation_items.length > 0) {
    await supabase.from("quotation_items").insert(
      original.quotation_items.map((item) => ({
        quotation_id: created.id,
        position: item.position,
        description: item.description,
        basis: item.basis,
        rate: item.rate,
        minimum_charge: item.minimum_charge,
        notes: item.notes,
      })),
    );
  }

  await supabase
    .from("quotations")
    .update({ status: "superseded", superseded_by: created.id })
    .eq("id", id);

  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  redirect(`/quotations/${created.id}?saved=revised`);
}

export async function addQuotationItem(quotationId: string, fd: FormData) {
  const { supabase } = await requireStaff();
  const description = text(fd, "description");
  if (!description) {
    redirect(`/quotations/${quotationId}?error=` + encodeURIComponent("Item description is required."));
  }
  const position = num(fd, "position") ?? 1;
  const { error } = await supabase.from("quotation_items").insert({
    quotation_id: quotationId,
    position,
    description,
    basis: text(fd, "basis"),
    rate: num(fd, "rate"),
    minimum_charge: num(fd, "minimum_charge"),
    notes: text(fd, "notes"),
  });
  if (error) redirect(`/quotations/${quotationId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/quotations/${quotationId}`);
  redirect(`/quotations/${quotationId}?saved=item`);
}

export async function updateQuotationItem(quotationId: string, itemId: string, fd: FormData) {
  const { supabase } = await requireStaff();
  const description = text(fd, "description");
  if (!description) {
    redirect(`/quotations/${quotationId}?error=` + encodeURIComponent("Item description is required."));
  }
  const { error } = await supabase
    .from("quotation_items")
    .update({
      position: num(fd, "position") ?? 1,
      description,
      basis: text(fd, "basis"),
      rate: num(fd, "rate"),
      minimum_charge: num(fd, "minimum_charge"),
      notes: text(fd, "notes"),
    })
    .eq("id", itemId)
    .eq("quotation_id", quotationId);
  if (error) redirect(`/quotations/${quotationId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/quotations/${quotationId}`);
  redirect(`/quotations/${quotationId}?saved=item`);
}

export async function deleteQuotationItem(quotationId: string, itemId: string) {
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("quotation_items")
    .delete()
    .eq("id", itemId)
    .eq("quotation_id", quotationId);
  if (error) redirect(`/quotations/${quotationId}?error=` + encodeURIComponent(friendlyError(error.message)));
  revalidatePath(`/quotations/${quotationId}`);
  redirect(`/quotations/${quotationId}?saved=item`);
}
