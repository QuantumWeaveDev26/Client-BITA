"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildSearchResponse,
  sanitizeSearchTerm,
  type SearchResponse,
  type SearchResultItem,
} from "@/lib/search";

export async function globalSearch(rawQuery: string): Promise<SearchResponse> {
  const term = sanitizeSearchTerm(rawQuery);
  if (!term) {
    return { query: "", groups: [], flat: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { query: term, groups: [], flat: [] };
  }

  const [jobsRes, customersRes, reportsRes, enquiriesRes, quotationsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, po_number, scope, status, customers(name)")
      .or(`job_no.ilike.%${term}%,po_number.ilike.%${term}%,scope.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("customers")
      .select("id, name, code, gstin")
      .or(`name.ilike.%${term}%,code.ilike.%${term}%,gstin.ilike.%${term}%`)
      .order("name")
      .limit(5),
    supabase
      .from("reports")
      .select("id, report_no, method, status, jobs(job_no, customers(name))")
      .ilike("report_no", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("enquiries")
      .select("id, subject, status, from_name, customers(name)")
      .or(`subject.ilike.%${term}%,from_name.ilike.%${term}%`)
      .order("received_at", { ascending: false })
      .limit(5),
    supabase
      .from("quotations")
      .select("id, ref_no, subject, status, customers(name)")
      .or(`ref_no.ilike.%${term}%,subject.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const matchedCustomers = customersRes.data ?? [];
  let jobsList = jobsRes.data ?? [];

  // If a customer matched by name and we have room for more job matches, surface that customer's jobs too.
  if (matchedCustomers.length > 0 && jobsList.length < 5) {
    const custIds = matchedCustomers.map((c) => c.id);
    const { data: customerJobs } = await supabase
      .from("jobs")
      .select("id, job_no, po_number, scope, status, customers(name)")
      .in("customer_id", custIds)
      .order("created_at", { ascending: false })
      .limit(5);
    const seen = new Set(jobsList.map((j) => j.id));
    for (const cj of customerJobs ?? []) {
      if (!seen.has(cj.id) && jobsList.length < 5) {
        jobsList = [...jobsList, cj];
        seen.add(cj.id);
      }
    }
  }

  const jobs: SearchResultItem[] = jobsList.map((j) => ({
    id: j.id,
    group: "Jobs",
    code: j.job_no,
    title: j.customers?.name ?? j.scope ?? "Job",
    subtitle: [j.po_number ? `PO ${j.po_number}` : null, j.scope].filter(Boolean).join(" · "),
    href: `/jobs/${j.id}`,
  }));

  const customers: SearchResultItem[] = matchedCustomers.map((c) => ({
    id: c.id,
    group: "Customers",
    code: c.code ?? undefined,
    title: c.name,
    subtitle: c.gstin ?? undefined,
    href: `/customers/${c.id}`,
  }));

  const reports: SearchResultItem[] = (reportsRes.data ?? []).map((r) => ({
    id: r.id,
    group: "Reports",
    code: r.report_no,
    title: `${r.method} · ${r.jobs?.customers?.name ?? "Report"}`,
    subtitle: [r.jobs?.job_no, r.status].filter(Boolean).join(" · "),
    href: `/review/${r.id}`,
  }));

  const enquiries: SearchResultItem[] = (enquiriesRes.data ?? []).map((e) => ({
    id: e.id,
    group: "Enquiries",
    title: e.subject ?? "(no subject)",
    subtitle: [e.customers?.name ?? e.from_name, e.status].filter(Boolean).join(" · "),
    href: `/enquiries/${e.id}`,
  }));

  const quotations: SearchResultItem[] = (quotationsRes.data ?? []).map((q) => ({
    id: q.id,
    group: "Quotations",
    code: q.ref_no ?? "Draft",
    title: q.customers?.name ?? q.subject ?? "Quotation",
    subtitle: [q.subject, q.status].filter(Boolean).join(" · "),
    href: `/quotations/${q.id}`,
  }));

  return buildSearchResponse(term, {
    Jobs: jobs,
    Customers: customers,
    Reports: reports,
    Enquiries: enquiries,
    Quotations: quotations,
  });
}
