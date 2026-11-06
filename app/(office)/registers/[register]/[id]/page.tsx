import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, Card, ErrorNote, Field, Input, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { saveRegister } from "../../actions";
import { calibrationStatus, isId, isRegister, TITLES } from "../../fields";
import { RegisterForm, type RegisterRecord } from "../../register-form";
import { StatusBadge } from "../../status-badge";

export default async function RegisterDetail({ params, searchParams }: {
  params: Promise<{ register: string; id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { register, id } = await params;
  if (!isRegister(register) || (id !== "new" && !isId(id))) notFound();
  const { error: formError, saved } = await searchParams;
  const { supabase, person } = await requireUser();
  const canEdit = person?.roles.includes("management") ?? false;
  if (id === "new" && !canEdit) redirect("/registers?error=Only%20management%20can%20add%20records.");
  const { data: people, error: peopleError } = await supabase.from("people").select("id, full_name, active").order("full_name");
  let record: RegisterRecord | undefined;
  let loadError: string | undefined = peopleError?.message;
  let qualificationStatus: string | undefined;
  if (id !== "new") {
    const { data, error } = await supabase.from(register).select("*").eq("id", id).maybeSingle();
    if (error) loadError = error.message;
    else if (!data) notFound();
    else record = data;
    if (register === "qualifications") {
      const { data: status, error: statusError } = await supabase.from("qualification_status").select("is_expired, valid_until").eq("id", id).maybeSingle();
      if (statusError) loadError = statusError.message;
      else if (status) qualificationStatus = status.is_expired ? "Expired" : status.valid_until ? "In date" : "Expiry not recorded";
    }
  }
  return <>
    <Link href={`/registers?tab=${register}`} className="mb-4 inline-block text-sm font-semibold text-red-700">← {TITLES[register]} register</Link>
    <PageHeader title={id === "new" ? `Add ${register === "people" ? "person" : register === "qualifications" ? "qualification" : "equipment"}` : `${TITLES[register]} record`} />
    <ErrorNote message={formError ?? loadError} />
    {saved && <p role="status" className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">Saved.</p>}
    {!canEdit && <p className="mb-4 text-sm text-neutral-600">Only management can edit this record.</p>}
    {!loadError && <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {qualificationStatus && <StatusBadge label={qualificationStatus} />}
        {record && "calibration_due" in record && <StatusBadge label={calibrationStatus(record.calibration_due)} />}
        {record && "certificate_path" in record && (record.certificate_path
          ? <a href={`/registers/${register}/${id}/certificate`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-red-700 underline">Open certificate copy</a>
          : <p className="text-sm text-neutral-500">No certificate copy uploaded.</p>)}
      </div>
      {register === "qualifications" && !people?.length ? <p className="text-sm">Add a person in the <Link href="/registers?tab=people" className="text-red-700 underline">people register</Link> first.</p>
        : <RegisterForm register={register} record={record} people={people ?? []} canEdit={canEdit} action={saveRegister.bind(null, register, id)} />}
      {canEdit && record && register !== "people" && <form action={`/registers/${register}/${id}/certificate`} method="post" encType="multipart/form-data" className="mt-6 space-y-3 border-t border-neutral-200 pt-4">
        <Field label={"certificate_path" in record && record.certificate_path ? "Replace certificate copy" : "Certificate copy"} hint="PDF, JPEG or PNG, up to 5 MB. Upload separately after saving details. The current copy stays linked if the upload fails.">
          <Input name="certificate" type="file" required accept="application/pdf,image/jpeg,image/png" />
        </Field>
        <Button type="submit">Upload certificate</Button>
      </form>}
    </Card>}
  </>;
}
