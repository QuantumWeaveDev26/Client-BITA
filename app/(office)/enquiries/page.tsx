import Link from "next/link";
import { Badge, ButtonLink, PageHeader, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Constants, type Enums } from "@/lib/db/types";
import { formatIST, SOURCE_LABEL, STATUS_LABEL } from "./labels";

export const metadata = { title: "Enquiries – BITA" };

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>;
}) {
  const { status, source } = await searchParams;
  const { supabase } = await requireUser();

  let query = supabase
    .from("enquiries")
    .select("id, source, subject, from_name, from_address, status, received_at, customers(name)")
    .order("received_at", { ascending: false })
    .limit(100);
  if (status && (Constants.public.Enums.enquiry_status as readonly string[]).includes(status))
    query = query.eq("status", status as Enums<"enquiry_status">);
  if (source && (Constants.public.Enums.enquiry_source as readonly string[]).includes(source))
    query = query.eq("source", source as Enums<"enquiry_source">);
  const { data: enquiries, error } = await query;

  return (
    <>
      <PageHeader title="Enquiries" action={<ButtonLink href="/enquiries/new">New enquiry</ButtonLink>} />
      <form className="mb-4 grid grid-cols-2 gap-3">
        <Select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          {Constants.public.Enums.enquiry_status.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={source ?? ""}>
          <option value="">All sources</option>
          {Constants.public.Enums.enquiry_source.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </Select>
        <button className="col-span-2 rounded-md border border-neutral-300 py-2 text-sm font-semibold hover:bg-neutral-100">
          Filter
        </button>
      </form>
      {error && <p className="text-sm text-red-700">{error.message}</p>}
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {enquiries?.map((e) => (
          <li key={e.id}>
            <Link href={`/enquiries/${e.id}`} className="block px-4 py-3 hover:bg-neutral-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.subject || "(no subject)"}</span>
                <Badge>{SOURCE_LABEL[e.source]}</Badge>
                <Badge>{STATUS_LABEL[e.status]}</Badge>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {e.customers?.name ?? e.from_name ?? e.from_address ?? "Unknown sender"} · {formatIST(e.received_at)}
              </div>
            </Link>
          </li>
        ))}
        {enquiries?.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">No enquiries found.</li>}
      </ul>
    </>
  );
}
