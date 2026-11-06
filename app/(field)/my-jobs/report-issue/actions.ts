"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTechnician } from "@/lib/auth";
import { Constants, type Enums } from "@/lib/db/types";
import { friendlyError, text } from "@/lib/forms";

export async function submitTechnicianIssue(fd: FormData) {
  const { supabase, person } = await requireTechnician();

  const rawKind = text(fd, "kind") ?? "other";
  const kind: Enums<"technician_message_kind"> = (
    Constants.public.Enums.technician_message_kind as readonly string[]
  ).includes(rawKind)
    ? (rawKind as Enums<"technician_message_kind">)
    : "other";

  const assignment_id = text(fd, "assignment_id");
  const body = text(fd, "body");
  const file = fd.get("photo");

  if (!body && (!(file instanceof File) || file.size === 0)) {
    redirect(
      "/my-jobs/report-issue?error=" +
        encodeURIComponent("Please enter a short note or attach a photo."),
    );
  }

  let job_id: string | null = null;
  if (assignment_id) {
    const { data: asn } = await supabase
      .from("assignments")
      .select("job_id")
      .eq("id", assignment_id)
      .eq("person_id", person.id)
      .maybeSingle();
    job_id = asn?.job_id ?? null;
  }

  const media_paths: string[] = [];
  if (file instanceof File && file.size > 0) {
    let uploadJobId = job_id;
    if (!uploadJobId) {
      const { data: latestAsn } = await supabase
        .from("assignments")
        .select("job_id")
        .eq("person_id", person.id)
        .order("work_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      uploadJobId = latestAsn?.job_id ?? null;
    }

    if (!uploadJobId) {
      redirect(
        "/my-jobs/report-issue?error=" +
          encodeURIComponent("Select a job to attach a photo, or submit the message without a photo."),
      );
    }

    const safeName = file.name.replace(/[^\w.-]+/g, "_");
    const path = `jobs/${uploadJobId}/issues/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      redirect(
        "/my-jobs/report-issue?error=" +
          encodeURIComponent("Photo upload failed: " + friendlyError(uploadError.message)),
      );
    }
    media_paths.push(path);
  }

  const { error } = await supabase.from("technician_messages").insert({
    person_id: person.id,
    assignment_id,
    job_id,
    kind,
    body,
    media_paths,
  });

  if (error) {
    redirect("/my-jobs/report-issue?error=" + encodeURIComponent(friendlyError(error.message)));
  }

  revalidatePath("/my-jobs");
  revalidatePath("/my-jobs/report-issue");
  redirect("/my-jobs/report-issue?saved=1");
}
