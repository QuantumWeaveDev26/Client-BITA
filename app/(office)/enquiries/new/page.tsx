import Link from "next/link";
import { Button, ErrorNote, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createEnquiry } from "../actions";
import { CustomerSelect } from "../customer-select";

export const metadata = { title: "New enquiry – BITA" };

// Phone and WhatsApp enquiries are entered here by hand. Email enquiries are captured automatically
// once mailbox access is set up; this form also covers an email entered by hand.
export default async function NewEnquiryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireUser();
  const { data: customers } = await supabase.from("customers").select("id, name").order("name");

  return (
    <>
      <PageHeader title="New enquiry" />
      <ErrorNote message={error} />
      <form action={createEnquiry} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Received by">
            <Select name="source" defaultValue="phone">
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </Select>
          </Field>
          <Field label="Received on" hint="Leave empty for now">
            <Input name="received_at" type="datetime-local" />
          </Field>
        </div>
        <Field label="Customer" hint="Pick an existing customer if you know who it is">
          <CustomerSelect customers={customers ?? []} />
        </Field>
        <p className="text-xs text-neutral-500">
          New customer? <Link href="/customers/new" className="text-red-700 underline">Add the customer first</Link>.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caller / sender name">
            <Input name="from_name" />
          </Field>
          <Field label="Phone number or email">
            <Input name="from_address" />
          </Field>
        </div>
        <Field label="Subject" hint="e.g. UT of 4 forged shafts">
          <Input name="subject" required />
        </Field>
        <Field label="Details">
          <Textarea name="body" rows={5} placeholder="Component, quantity, test method, site, dates…" />
        </Field>
        <Button type="submit">Save enquiry</Button>
      </form>
    </>
  );
}
