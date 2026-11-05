import { Select } from "@/components/ui";

export function CustomerSelect({
  customers,
  defaultValue,
}: {
  customers: { id: string; name: string }[];
  defaultValue?: string | null;
}) {
  return (
    <Select name="customer_id" defaultValue={defaultValue ?? ""}>
      <option value="">Not linked yet</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
