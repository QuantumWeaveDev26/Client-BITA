import { requireUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { CERTIFICATE_TYPES, certificateError, isId, MAX_CERTIFICATE_BYTES } from "../../../fields";

type Context = { params: Promise<{ register: string; id: string }> };

// Uploads use a route rather than a server action, keeping large files outside the shared action body limit.
// Bound the multipart body even when the browser sends no Content-Length header.
async function certificateForm(request: Request) {
  const limit = MAX_CERTIFICATE_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new Error("The certificate must be 5 MB or smaller.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a certificate copy.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new Error("The certificate must be 5 MB or smaller.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

export async function POST(request: Request, { params }: Context) {
  const { register, id } = await params;
  if ((register !== "qualifications" && register !== "equipment") || !isId(id)) return new Response("Not found", { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Upload must come from this app.", { status: 403 });
  const { supabase, person } = await requireUser();
  if (!person?.roles.includes("management")) return new Response("Only management can upload certificates.", { status: 403 });
  const result = (message?: string) => {
    const target = new URL(`/registers/${register}/${id}`, request.url);
    if (message) target.searchParams.set("error", message);
    else target.searchParams.set("saved", "1");
    return new Response(null, { status: 303, headers: { Location: target.toString(), "Cache-Control": "private, no-store" } });
  };
  // The owner comes from an authorized record lookup, never from form fields.
  let owner = id;
  if (register === "qualifications") {
    const { data, error } = await supabase.from("qualifications").select("person_id").eq("id", id).maybeSingle();
    if (error) return result("The record could not be checked. Please try again.");
    if (!data) return new Response("Not found", { status: 404 });
    owner = data.person_id;
  } else {
    const { data, error } = await supabase.from("equipment").select("id").eq("id", id).maybeSingle();
    if (error) return result("The record could not be checked. Please try again.");
    if (!data) return new Response("Not found", { status: 404 });
  }
  let form: FormData;
  try { form = await certificateForm(request); }
  catch (error) { return result(error instanceof Error && error.message.includes("5 MB") ? error.message : "The upload could not be read. Choose a certificate and try again."); }
  const file = form.get("certificate");
  if (!(file instanceof File) || !file.size) return result("Choose a certificate copy.");
  const problem = certificateError(file);
  if (problem) return result(problem);
  const extension = CERTIFICATE_TYPES[file.type as keyof typeof CERTIFICATE_TYPES];
  const path = `${register === "qualifications" ? "certificates" : "calibration"}/${owner}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return result("Certificate upload failed. Your saved details and existing copy are unchanged. Please try again.");
  const { data, error } = await supabase.from(register).update({ certificate_path: path }).eq("id", id).select("id").single();
  if (error || !data) return result("The uploaded certificate could not be linked. Your existing copy is unchanged. Please try again.");
  revalidatePath("/registers", "layout");
  return result();
}

// Re-authorize each click with the user's RLS-scoped client; never accept a storage path from the URL.
export async function GET(_request: Request, { params }: Context) {
  const { register, id } = await params;
  if ((register !== "qualifications" && register !== "equipment") || !isId(id)) return new Response("Not found", { status: 404 });
  const { supabase } = await requireUser();
  let path: string | null;
  let prefix: string;
  if (register === "qualifications") {
    const { data, error } = await supabase.from("qualifications").select("person_id, certificate_path").eq("id", id).maybeSingle();
    if (error) return new Response("Certificate unavailable. Please try again.", { status: 503 });
    if (!data) return new Response("Not found", { status: 404 });
    path = data.certificate_path;
    prefix = `certificates/${data.person_id}/`;
  } else {
    const { data, error } = await supabase.from("equipment").select("certificate_path").eq("id", id).maybeSingle();
    if (error) return new Response("Certificate unavailable. Please try again.", { status: 503 });
    if (!data) return new Response("Not found", { status: 404 });
    path = data.certificate_path;
    prefix = `calibration/${id}/`;
  }
  if (!path || !path.startsWith(prefix) || path.split("/").some((part) => part === ".." || part === ".")) return new Response("Certificate not found", { status: 404 });
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60, { download: true });
  if (error || !data) return new Response("Certificate unavailable. Please try again.", { status: 503 });
  return new Response(null, { status: 303, headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" } });
}
