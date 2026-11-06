import { requireStaff } from "@/lib/auth";
import { isValidQuotationStoragePath, quotationFileName } from "../../upload";

type Context = { params: Promise<{ id: string }> };

// Re-authorize each click with the user's RLS-scoped client and redirect to a short-lived signed download URL.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: quotation, error } = await supabase
    .from("quotations")
    .select("id, pdf_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new Response("Quotation file unavailable. Please try again.", { status: 503 });
  }
  if (!quotation || !isValidQuotationStoragePath(id, quotation.pdf_path)) {
    return new Response("Uploaded quotation file not found.", { status: 404 });
  }

  const fileName = quotationFileName(quotation.pdf_path) ?? true;
  const { data, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(quotation.pdf_path!, 120, { download: fileName });

  if (signError || !data?.signedUrl) {
    return new Response("Quotation file unavailable. Please try again.", { status: 503 });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: data.signedUrl,
      "Cache-Control": "private, no-store",
    },
  });
}
