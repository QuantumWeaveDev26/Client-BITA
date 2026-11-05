import { ErrorNote, PageHeader } from "@/components/ui";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "New customer – BITA" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <PageHeader title="New customer" />
      <ErrorNote message={error} />
      <CustomerForm action={createCustomer} submitLabel="Save customer" />
    </>
  );
}
