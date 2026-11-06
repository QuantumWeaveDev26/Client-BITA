"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTechnician } from "@/lib/auth";
import { Constants, type Enums, type Json } from "@/lib/db/types";
import { friendlyError, text } from "@/lib/forms";
import {
  ITEM_FIELDS,
  missingFieldsForAnyMethod,
  scalarFieldsForAnyMethod,
  TECHNICIAN_FIELDS,
} from "../report-fields";

const VALID_ATTACHMENT_KINDS = [
  "site_photo",
  "defect_photo",
  "drawing",
  "supporting_document",
  "other",
] as const;

function parseNumberOrString(raw: string | null, inputType: "text" | "date" | "number" | "textarea") {
  if (raw === null) return null;
  if (inputType === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

export async function saveMethodReadings(
  assignmentId: string,
  method: Enums<"test_method">,
  fd: FormData,
) {
  const { supabase, person } = await requireTechnician();

  if (!(Constants.public.Enums.test_method as readonly string[]).includes(method)) {
    redirect(`/my-jobs/${assignmentId}?error=` + encodeURIComponent("Invalid test method."));
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, job_id, acknowledged_at")
    .eq("id", assignmentId)
    .eq("person_id", person.id)
    .maybeSingle();

  if (!assignment) {
    redirect("/my-jobs?error=" + encodeURIComponent("Assignment not found."));
  }

  const intent = text(fd, "intent") === "submit" ? "submit" : "draft";
  const observations = text(fd, "observations");

  const readings: Record<string, Json | undefined> = {};
  for (const def of scalarFieldsForAnyMethod(method)) {
    const val = parseNumberOrString(text(fd, def.key), def.input);
    readings[def.key] = val;
  }

  const techCount = Math.max(1, Math.min(20, Number(fd.get("technicians_count") ?? 1) || 1));
  const technicians: Record<string, Json | undefined>[] = [];
  for (let i = 0; i < techCount; i++) {
    const row: Record<string, Json | undefined> = {};
    for (const def of TECHNICIAN_FIELDS) {
      row[def.key] = parseNumberOrString(text(fd, `technicians.${i}.${def.key}`), def.input);
    }
    technicians.push(row);
  }
  readings.technicians = technicians as Json;

  const itemCount = Math.max(1, Math.min(100, Number(fd.get("items_count") ?? 1) || 1));
  const items: Record<string, Json | undefined>[] = [];
  for (let i = 0; i < itemCount; i++) {
    const row: Record<string, Json | undefined> = {};
    for (const def of ITEM_FIELDS) {
      row[def.key] = parseNumberOrString(text(fd, `items.${i}.${def.key}`), def.input);
    }
    items.push(row);
  }
  readings.items = items as Json;

  const missing_fields = missingFieldsForAnyMethod(method, readings);
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("inspections")
    .select("id, submitted_at")
    .eq("job_id", assignment.job_id)
    .eq("method", method)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("inspections")
      .update({
        assignment_id: assignment.id,
        readings: readings as Json,
        observations,
        missing_fields,
        submitted_by: person.id,
        ...(intent === "submit" ? { submitted_at: nowIso } : {}),
      })
      .eq("id", existing.id);

    if (error) {
      redirect(
        `/my-jobs/${assignmentId}?method=${method}&error=` +
          encodeURIComponent(friendlyError(error.message)),
      );
    }
  } else {
    const { error } = await supabase.from("inspections").insert({
      job_id: assignment.job_id,
      assignment_id: assignment.id,
      method,
      readings: readings as Json,
      observations,
      missing_fields,
      submitted_by: person.id,
      submitted_at: intent === "submit" ? nowIso : null,
    });

    if (error) {
      redirect(
        `/my-jobs/${assignmentId}?method=${method}&error=` +
          encodeURIComponent(friendlyError(error.message)),
      );
    }
  }

  if (intent === "submit") {
    await supabase
      .from("assignments")
      .update({
        acknowledged_at: assignment.acknowledged_at ?? nowIso,
        completed_at: nowIso,
      })
      .eq("id", assignment.id);
  }

  revalidatePath("/my-jobs");
  revalidatePath(`/my-jobs/${assignmentId}`);
  redirect(
    `/my-jobs/${assignmentId}?method=${method}&saved=${intent === "submit" ? "submitted" : "draft"}`,
  );
}

export async function uploadJobAttachment(assignmentId: string, fd: FormData) {
  const { supabase, person } = await requireTechnician();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, job_id")
    .eq("id", assignmentId)
    .eq("person_id", person.id)
    .maybeSingle();

  if (!assignment) {
    redirect("/my-jobs?error=" + encodeURIComponent("Assignment not found."));
  }

  const rawKind = text(fd, "kind") ?? "site_photo";
  const kind = (VALID_ATTACHMENT_KINDS as readonly string[]).includes(rawKind)
    ? rawKind
    : "site_photo";
  const caption = text(fd, "caption");
  const inspection_id = text(fd, "inspection_id");
  const file = fd.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/my-jobs/${assignmentId}?error=` + encodeURIComponent("Please choose a photo or drawing to upload."),
    );
  }

  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const storage_path = `jobs/${assignment.job_id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storage_path, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    redirect(
      `/my-jobs/${assignmentId}?error=` +
        encodeURIComponent("Upload failed: " + friendlyError(uploadError.message)),
    );
  }

  const { error: insertError } = await supabase.from("attachments").insert({
    job_id: assignment.job_id,
    inspection_id: inspection_id || null,
    kind,
    caption,
    storage_path,
    uploaded_by: person.id,
  });

  if (insertError) {
    redirect(
      `/my-jobs/${assignmentId}?error=` +
        encodeURIComponent("File uploaded, but attachment record failed: " + friendlyError(insertError.message)),
    );
  }

  revalidatePath(`/my-jobs/${assignmentId}`);
  redirect(`/my-jobs/${assignmentId}?saved=photo`);
}
