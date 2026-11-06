import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Constants, type Tables } from "@/lib/db/types";
import { DEFAULT_QUOTATION_TERMS, QUOTATION_STATUS_LABEL } from "./labels";

type Option = { id: string; label: string };

export function QuotationForm({
  action,
  quotation,
  defaults,
  customers,
  enquiries,
  includeFirstItem = false,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  quotation?: Tables<"quotations">;
  defaults?: {
    customer_id?: string;
    enquiry_id?: string;
    attention?: string;
    subject?: string;
  };
  customers: Option[];
  enquiries: Option[];
  includeFirstItem?: boolean;
  submitLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="max-w-xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quotation Ref. No." hint="BITA format, e.g. 027-2026">
          <Input name="ref_no" placeholder="027-2026" defaultValue={quotation?.ref_no ?? ""} />
        </Field>
        <Field label="Quotation date">
          <Input name="quote_date" type="date" required defaultValue={quotation?.quote_date ?? today} />
        </Field>
      </div>

      <Field label="Customer">
        <Select name="customer_id" required defaultValue={quotation?.customer_id ?? defaults?.customer_id ?? ""}>
          <option value="" disabled>
            Choose a customer…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Enquiry (if any)">
        <Select name="enquiry_id" defaultValue={quotation?.enquiry_id ?? defaults?.enquiry_id ?? ""}>
          <option value="">None</option>
          {enquiries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Kind attention" hint="Contact person or department at the customer">
        <Input name="attention" placeholder="Purchase / Quality Department" defaultValue={quotation?.attention ?? defaults?.attention ?? ""} />
      </Field>

      <Field label="Subject" hint="Component and NDT method, e.g. Ultrasonic Testing of Forged Shafts">
        <Input name="subject" defaultValue={quotation?.subject ?? defaults?.subject ?? ""} />
      </Field>

      <Field label="Terms and conditions" hint="No fixed expiry date (R11, R12)">
        <Textarea name="terms" defaultValue={quotation?.terms ?? DEFAULT_QUOTATION_TERMS} />
      </Field>

      {includeFirstItem && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-3">
          <p className="text-sm font-semibold text-neutral-800">First priced item (optional – you can add more items after saving)</p>
          <Field label="Component / scope description">
            <Input name="item_description" placeholder="UT of forged shafts at customer works" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Rate (INR)">
              <Input name="item_rate" type="number" step="0.01" min="0" placeholder="2500" />
            </Field>
            <Field label="Basis">
              <Input name="item_basis" placeholder="per shaft / per visit" />
            </Field>
            <Field label="Minimum charge (INR)">
              <Input name="item_minimum_charge" type="number" step="0.01" min="0" placeholder="5500" />
            </Field>
          </div>
          <Field label="Item notes">
            <Input name="item_notes" placeholder="Conveyance or minimum billing notes" />
          </Field>
        </div>
      )}

      {quotation && (
        <Field label="Status" hint="Approval requires management (R10)">
          <Select name="status" defaultValue={quotation.status}>
            {Constants.public.Enums.quotation_status.map((s) => (
              <option key={s} value={s}>
                {QUOTATION_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Signed quotation PDF (optional)" hint="Attach an external PDF if needed">
        <Input name="pdf_file" type="file" accept=".pdf" />
      </Field>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
