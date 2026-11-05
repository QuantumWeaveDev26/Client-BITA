import { Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import type { Tables } from "@/lib/db/types";

// Shared by "new customer" and "edit customer".
export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  customer?: Tables<"customers">;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <Field label="Company name">
        <Input name="name" required defaultValue={customer?.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Short code" hint="Used in report numbers, e.g. TDPS">
          <Input name="code" defaultValue={customer?.code ?? ""} />
        </Field>
        <Field label="GSTIN">
          <Input name="gstin" maxLength={15} defaultValue={customer?.gstin ?? ""} />
        </Field>
      </div>
      <Field label="Billing address">
        <Textarea name="billing_address" defaultValue={customer?.billing_address ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payment terms (days from invoice)">
          <Input name="payment_terms_days" type="number" min={0} defaultValue={customer?.payment_terms_days ?? 30} />
        </Field>
        <Field label="BITA mailbox for this customer" hint="Reminders are sent from this address">
          <Input name="mailbox" type="email" defaultValue={customer?.mailbox ?? ""} />
        </Field>
      </div>
      <Checkbox
        name="uses_proforma"
        label="Send a proforma invoice before the GST invoice"
        defaultChecked={customer?.uses_proforma ?? false}
      />
      <Field label="Notes">
        <Textarea name="notes" defaultValue={customer?.notes ?? ""} />
      </Field>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
