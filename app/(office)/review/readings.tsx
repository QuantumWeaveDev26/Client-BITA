import { Card, SectionTitle, Status } from "@/components/ui";
import { fieldsForMethod, REPEATING_GROUPS, type ReportMethod, type ReportReadings } from "@/lib/reports/fields";

function reading(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "Not recorded";
}

export function ReviewReadings({ method, readings, missing }: { method: ReportMethod; readings: ReportReadings; missing: readonly string[] }) {
  const values = readings && typeof readings === "object" && !Array.isArray(readings) ? readings as Record<string, unknown> : {};
  return <div className="space-y-5">
    <section><SectionTitle>Inspection readings</SectionTitle><Card>
      <dl className="grid gap-4 sm:grid-cols-2">{fieldsForMethod(method).map((field) => <div key={field.key} className="min-w-0 break-words">
        <dt className="text-sm text-ink-2">{field.label}</dt>
        <dd className="mt-1 whitespace-pre-wrap">{missing.includes(field.key) ? <Status tone="bad">Missing — {reading(values[field.key])}</Status> : reading(values[field.key])}</dd>
      </div>)}</dl>
    </Card></section>
    {REPEATING_GROUPS.map((group) => {
      const rows = values[group.key] as Record<string, unknown>[] | undefined;
      return <section key={group.key}><SectionTitle>{group.label}</SectionTitle>
        {!Array.isArray(rows) || !rows.length ? <Status tone="bad">At least one row is missing</Status> : <div className="space-y-3">{rows.map((row, index) => <Card key={index}>
          <p className="mb-3 text-sm font-medium">{group.key === "items" ? "Item" : "Technician"} {index + 1}</p>
          <dl className="grid gap-4 sm:grid-cols-2">{group.fields.map((field) => <div key={field.key} className="min-w-0 break-words">
            <dt className="text-sm text-ink-2">{field.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{missing.includes(`${group.key}.${index}.${field.key}`) ? <Status tone="bad">Missing — {reading(row?.[field.key])}</Status> : reading(row?.[field.key])}</dd>
          </div>)}</dl>
        </Card>)}</div>}
      </section>;
    })}
  </div>;
}
