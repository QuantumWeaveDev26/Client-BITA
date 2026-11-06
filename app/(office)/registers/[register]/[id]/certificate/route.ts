import { requireUser } from "@/lib/auth";
import { isId } from "../../../fields";

// Re-authorize each click with the user's RLS-scoped client; never accept a storage path from the URL.
export async function GET(_request: Request, { params }: { params: Promise<{ register: string; id: string }> }) {
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
