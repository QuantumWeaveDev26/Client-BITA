// Zoho Books API client (India data centre: accounts.zoho.in / www.zohoapis.in/books/v3).
// Hard rules (AGENTS.md 4 & 5):
// - Zoho Books is the source of truth for money. Never calculate GST or keep a ledger in our code.
// - Every Zoho record carries the Job ID (`reference_number: job.job_no`).
// - Before creating a GST invoice, check that the job has no existing `zoho_invoice_id` / `tax_invoice`.

export const ZOHO_INDIA_ACCOUNTS_URL = "https://accounts.zoho.in/oauth/v2/token";
export const ZOHO_INDIA_BOOKS_BASE_URL = "https://www.zohoapis.in/books/v3";

export type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  fetchImpl?: typeof fetch;
};

export type ZohoCustomerInput = {
  id?: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  payment_terms_days?: number | null;
  zoho_contact_id?: string | null;
  contacts?: readonly {
    name: string;
    email?: string | null;
    mobile?: string | null;
  }[];
};

export type ZohoJobInput = {
  id: string;
  job_no: string;
  zoho_contact_id: string;
  po_number?: string | null;
  zoho_invoice_id?: string | null;
  has_tax_invoice?: boolean;
};

export type ZohoLineItemInput = {
  description: string;
  rate: number;
  quantity?: number;
};

export type ZohoDocumentMirror = {
  zoho_id: string;
  kind: "proforma" | "tax_invoice";
  number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  status: string | null;
  reference_number: string | null;
  customer_po_number?: string | null;
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
  refreshTokenKey: string;
};

let cachedToken: TokenCache | null = null;

export function clearZohoTokenCache() {
  cachedToken = null;
}

export function resolveZohoConfig(overrides?: Partial<ZohoConfig>): ZohoConfig {
  const clientId = overrides?.clientId ?? process.env.ZOHO_CLIENT_ID ?? "";
  const clientSecret = overrides?.clientSecret ?? process.env.ZOHO_CLIENT_SECRET ?? "";
  const refreshToken = overrides?.refreshToken ?? process.env.ZOHO_REFRESH_TOKEN ?? "";
  const organizationId = overrides?.organizationId ?? process.env.ZOHO_ORGANIZATION_ID ?? "";

  if (!clientId || !clientSecret || !refreshToken || !organizationId) {
    throw new Error(
      "Missing Zoho Books India configuration (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORGANIZATION_ID)."
    );
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    organizationId,
    fetchImpl: overrides?.fetchImpl ?? fetch,
  };
}

export async function getZohoAccessToken(overrides?: Partial<ZohoConfig>): Promise<string> {
  const cfg = resolveZohoConfig(overrides);
  const now = Date.now();
  if (
    cachedToken &&
    cachedToken.refreshTokenKey === cfg.refreshToken &&
    cachedToken.expiresAtMs > now + 30_000
  ) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await cfg.fetchImpl!(ZOHO_INDIA_ACCOUNTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Zoho OAuth token refresh failed with HTTP ${res.status}.`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!data.access_token) {
    throw new Error(`Zoho OAuth token response missing access_token (${data.error ?? "unknown"}).`);
  }

  const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 3600;
  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
    refreshTokenKey: cfg.refreshToken,
  };

  return data.access_token;
}

async function zohoRequest<T>(
  path: string,
  init: {
    method?: "GET" | "POST" | "PUT";
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  },
  overrides?: Partial<ZohoConfig>
): Promise<T> {
  const cfg = resolveZohoConfig(overrides);
  const token = await getZohoAccessToken(cfg);

  const url = new URL(`${ZOHO_INDIA_BOOKS_BASE_URL}${path}`);
  url.searchParams.set("organization_id", cfg.organizationId);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await cfg.fetchImpl!(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Zoho Books API ${init.method ?? "GET"} ${path} failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as T;
}

function assertValidJobReference(jobNo: string | null | undefined) {
  if (!jobNo || !jobNo.trim()) {
    throw new Error("Every Zoho record must carry the BITA Job ID (AGENTS.md rule 5).");
  }
}

function buildZohoLineItems(items: readonly ZohoLineItemInput[]) {
  if (items.length === 0) {
    throw new Error("At least one line item is required for a Zoho Books proforma or invoice.");
  }
  // Rule 4: We send only description, rate and quantity. Zoho Books calculates GST and totals.
  return items.map((item) => ({
    description: item.description,
    rate: item.rate,
    quantity: item.quantity ?? 1,
  }));
}

export async function upsertContact(
  customer: ZohoCustomerInput,
  overrides?: Partial<ZohoConfig>
): Promise<{ zoho_contact_id: string; contact_name: string; gst_no: string | null }> {
  if (!customer.name.trim()) {
    throw new Error("Customer name is required to upsert a Zoho Books contact.");
  }

  const payload: Record<string, unknown> = {
    contact_name: customer.name.trim(),
    contact_type: "customer",
    ...(customer.gstin ? { gst_no: customer.gstin.trim() } : {}),
    ...(typeof customer.payment_terms_days === "number"
      ? { payment_terms: customer.payment_terms_days }
      : {}),
    ...(customer.contacts && customer.contacts.length > 0
      ? {
          contact_persons: customer.contacts.map((c, idx) => ({
            first_name: c.name,
            ...(c.email ? { email: c.email } : {}),
            ...(c.mobile ? { mobile: c.mobile } : {}),
            is_primary_contact: idx === 0,
          })),
        }
      : {}),
  };

  let targetContactId = customer.zoho_contact_id?.trim() || null;

  if (!targetContactId) {
    const searchRes = await zohoRequest<{
      contacts?: { contact_id: string; contact_name: string; gst_no?: string }[];
    }>(
      "/contacts",
      {
        method: "GET",
        query: { contact_name: customer.name.trim() },
      },
      overrides
    );
    const existing = searchRes.contacts?.[0];
    if (existing?.contact_id) {
      targetContactId = existing.contact_id;
    }
  }

  if (targetContactId) {
    const updated = await zohoRequest<{
      contact: { contact_id: string; contact_name: string; gst_no?: string };
    }>(
      `/contacts/${encodeURIComponent(targetContactId)}`,
      {
        method: "PUT",
        body: payload,
      },
      overrides
    );
    return {
      zoho_contact_id: updated.contact.contact_id,
      contact_name: updated.contact.contact_name,
      gst_no: updated.contact.gst_no ?? customer.gstin ?? null,
    };
  }

  const created = await zohoRequest<{
    contact: { contact_id: string; contact_name: string; gst_no?: string };
  }>(
    "/contacts",
    {
      method: "POST",
      body: payload,
    },
    overrides
  );

  return {
    zoho_contact_id: created.contact.contact_id,
    contact_name: created.contact.contact_name,
    gst_no: created.contact.gst_no ?? customer.gstin ?? null,
  };
}

export async function createEstimate(
  job: ZohoJobInput,
  items: readonly ZohoLineItemInput[],
  overrides?: Partial<ZohoConfig>
): Promise<ZohoDocumentMirror> {
  assertValidJobReference(job.job_no);
  if (!job.zoho_contact_id?.trim()) {
    throw new Error("Customer must have a Zoho contact ID before creating a proforma estimate.");
  }

  const res = await zohoRequest<{
    estimate: {
      estimate_id: string;
      estimate_number?: string;
      date?: string;
      expiry_date?: string;
      total?: number;
      status?: string;
      reference_number?: string;
    };
  }>(
    "/estimates",
    {
      method: "POST",
      body: {
        customer_id: job.zoho_contact_id.trim(),
        reference_number: job.job_no.trim(),
        line_items: buildZohoLineItems(items),
      },
    },
    overrides
  );

  const est = res.estimate;
  return {
    zoho_id: est.estimate_id,
    kind: "proforma",
    number: est.estimate_number ?? null,
    invoice_date: est.date ?? null,
    due_date: est.expiry_date ?? null,
    total: typeof est.total === "number" ? est.total : null,
    balance: typeof est.total === "number" ? est.total : null,
    status: est.status ?? "draft",
    reference_number: est.reference_number ?? job.job_no.trim(),
    customer_po_number: job.po_number ?? null,
  };
}

function mapZohoInvoiceToMirror(inv: {
  invoice_id: string;
  invoice_number?: string;
  date?: string;
  due_date?: string;
  total?: number;
  balance?: number;
  status?: string;
  reference_number?: string;
}): ZohoDocumentMirror {
  return {
    zoho_id: inv.invoice_id,
    kind: "tax_invoice",
    number: inv.invoice_number ?? null,
    invoice_date: inv.date ?? null,
    due_date: inv.due_date ?? null,
    total: typeof inv.total === "number" ? inv.total : null,
    balance: typeof inv.balance === "number" ? inv.balance : null,
    status: inv.status ?? null,
    reference_number: inv.reference_number ?? null,
  };
}

export async function createInvoice(
  job: ZohoJobInput,
  items: readonly ZohoLineItemInput[],
  overrides?: Partial<ZohoConfig> & {
    hasExistingTaxInvoice?: (jobId: string) => Promise<boolean>;
  }
): Promise<ZohoDocumentMirror> {
  assertValidJobReference(job.job_no);
  if (!job.zoho_contact_id?.trim()) {
    throw new Error("Customer must have a Zoho contact ID before creating a GST invoice.");
  }

  // AGENTS.md rule 5: Before creating an invoice, check that the job has no zoho_invoice_id / tax_invoice yet.
  if (job.zoho_invoice_id || job.has_tax_invoice) {
    throw new Error(
      `Job ${job.job_no} already has a Zoho GST invoice; refusing to create a duplicate (AGENTS.md rule 5).`
    );
  }
  if (overrides?.hasExistingTaxInvoice && (await overrides.hasExistingTaxInvoice(job.id))) {
    throw new Error(
      `Job ${job.job_no} already has a tax_invoice row in the database; refusing to create a duplicate (AGENTS.md rule 5).`
    );
  }

  const res = await zohoRequest<{
    invoice: {
      invoice_id: string;
      invoice_number?: string;
      date?: string;
      due_date?: string;
      total?: number;
      balance?: number;
      status?: string;
      reference_number?: string;
    };
  }>(
    "/invoices",
    {
      method: "POST",
      body: {
        customer_id: job.zoho_contact_id.trim(),
        reference_number: job.job_no.trim(),
        line_items: buildZohoLineItems(items),
      },
    },
    overrides
  );

  return mapZohoInvoiceToMirror(res.invoice);
}

export async function getInvoice(
  zohoInvoiceId: string,
  overrides?: Partial<ZohoConfig>
): Promise<ZohoDocumentMirror> {
  if (!zohoInvoiceId.trim()) {
    throw new Error("A Zoho invoice ID is required.");
  }
  const res = await zohoRequest<{
    invoice: {
      invoice_id: string;
      invoice_number?: string;
      date?: string;
      due_date?: string;
      total?: number;
      balance?: number;
      status?: string;
      reference_number?: string;
    };
  }>(`/invoices/${encodeURIComponent(zohoInvoiceId.trim())}`, { method: "GET" }, overrides);

  return mapZohoInvoiceToMirror(res.invoice);
}

export async function listInvoicesModifiedSince(
  sinceDate: string | Date,
  overrides?: Partial<ZohoConfig>
): Promise<ZohoDocumentMirror[]> {
  const formatted =
    sinceDate instanceof Date
      ? `${sinceDate.toISOString().slice(0, 19)}+0000`
      : sinceDate.trim();

  const res = await zohoRequest<{
    invoices?: {
      invoice_id: string;
      invoice_number?: string;
      date?: string;
      due_date?: string;
      total?: number;
      balance?: number;
      status?: string;
      reference_number?: string;
    }[];
  }>(
    "/invoices",
    {
      method: "GET",
      query: { last_modified_time: formatted },
    },
    overrides
  );

  return (res.invoices ?? []).map(mapZohoInvoiceToMirror);
}
