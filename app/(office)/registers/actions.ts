"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/forms";
import {
  CERTIFICATE_TYPES, certificateError, equipmentFields, isId, isRegister,
  personFields, qualificationFields, type Register,
} from "./fields";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function errorMessage(error: { message: string }) {
  if (error.message.includes("people_initials_key")) return "Another person already uses these initials.";
  if (error.message.includes("equipment_serial_no_key")) return "Another equipment record already uses this serial number.";
  return friendlyError(error.message);
}

export async function saveRegister(register: Register, recordId: string, fd: FormData) {
  if (!isRegister(register) || (recordId !== "new" && !isId(recordId))) redirect("/registers");
  const path = `/registers/${register}/${recordId}`;
  const { supabase, person } = await requireUser();
  if (!person?.roles.includes("management")) fail("/registers", "Only management can change registers.");
  const isNew = recordId === "new";
  const id = isNew ? randomUUID() : recordId;

  // Check authorization before accepting file bytes or performing a write. RLS remains the final guard.
  const certificate = fd.get("certificate");
  const file = certificate instanceof File && certificate.size > 0 ? certificate : null;
  if (file && register !== "people") {
    const problem = certificateError(file);
    if (problem) fail(path, problem);
  }

  let certificateOwner = id;
  let payload;
  try {
    payload = register === "people" ? personFields(fd)
      : register === "qualifications" ? qualificationFields(fd) : equipmentFields(fd);
  } catch (error) {
    fail(path, error instanceof Error ? error.message : "Check the form fields.");
  }

  if (register === "people") {
    const fields = payload as ReturnType<typeof personFields>;
    // Avoid locking the manager out of their own account while editing the staff register.
    if (id === person.id && (!fields.active || !fields.roles?.includes("management"))) {
      fail(path, "You cannot deactivate yourself or remove your own management role.");
    }
    const query = isNew ? supabase.from("people").insert({ ...fields, id })
      : supabase.from("people").update(fields).eq("id", id);
    const { data, error } = await query.select("id").single();
    if (error || !data) fail(path, error ? errorMessage(error) : "Person not found or permission denied.");
  } else if (register === "qualifications") {
    const fields = payload as ReturnType<typeof qualificationFields>;
    if (!isNew) {
      const { data: existing, error } = await supabase.from("qualifications").select("person_id").eq("id", id).maybeSingle();
      if (error || !existing) fail(path, error ? errorMessage(error) : "Qualification not found.");
      if (fields.person_id !== existing.person_id) fail(path, "A qualification stays with its original person. Add a new qualification for another person.");
    }
    certificateOwner = fields.person_id;
    const query = isNew ? supabase.from("qualifications").insert({ ...fields, id })
      : supabase.from("qualifications").update(fields).eq("id", id);
    const { data, error } = await query.select("id").single();
    if (error || !data) fail(path, error ? errorMessage(error) : "Qualification not found or permission denied.");
  } else {
    const fields = payload as ReturnType<typeof equipmentFields>;
    const query = isNew ? supabase.from("equipment").insert({ ...fields, id })
      : supabase.from("equipment").update(fields).eq("id", id);
    const { data, error } = await query.select("id").single();
    if (error || !data) fail(path, error ? errorMessage(error) : "Equipment not found or permission denied.");
  }

  const savedPath = `/registers/${register}/${id}`;
  revalidatePath("/registers", "layout");
  if (file && register !== "people") {
    const folder = register === "qualifications" ? "certificates" : "calibration";
    const extension = CERTIFICATE_TYPES[file.type as keyof typeof CERTIFICATE_TYPES];
    const storagePath = `${folder}/${certificateOwner}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) fail(savedPath, "Details saved, but the certificate upload failed. Please try uploading again.");
    // Existing certificate stays linked until the new copy has uploaded successfully.
    const { data, error } = await supabase.from(register).update({ certificate_path: storagePath }).eq("id", id)
      .select("id").single();
    if (error || !data) fail(savedPath, "Details saved, but the certificate could not be linked. Please try again.");
    revalidatePath("/registers", "layout");
  }
  redirect(`${savedPath}?saved=1`);
}
