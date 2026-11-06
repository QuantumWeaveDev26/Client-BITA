"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  SecondaryButton,
  SectionTitle,
  Status,
  Textarea,
} from "@/components/ui";
import type { Enums } from "@/lib/db/types";
import { METHOD_LABEL } from "../../../(office)/jobs/labels";
import {
  type FieldDefinition,
  formatMissingFieldLabel,
  ITEM_FIELDS,
  type ItemReadings,
  scalarFieldsForAnyMethod,
  TECHNICIAN_FIELDS,
  type TechnicianReadings,
} from "../report-fields";

function renderFieldInput(
  def: FieldDefinition,
  name: string,
  defaultValue: string | number | null | undefined,
) {
  const strVal = defaultValue === null || defaultValue === undefined ? "" : String(defaultValue);
  if (def.input === "textarea") {
    return <Textarea name={name} defaultValue={strVal} />;
  }
  return <Input type={def.input} name={name} defaultValue={strVal} />;
}

export function ReadingsForm({
  action,
  method,
  initialReadings,
  initialObservations,
  missingFields,
  submittedAt,
}: {
  action: (fd: FormData) => void;
  method: Enums<"test_method">;
  initialReadings: Record<string, unknown>;
  initialObservations: string | null;
  missingFields: string[];
  submittedAt: string | null;
}) {
  const initialTechs: TechnicianReadings[] =
    Array.isArray(initialReadings.technicians) && initialReadings.technicians.length > 0
      ? (initialReadings.technicians as TechnicianReadings[])
      : [{}];

  const initialItems: ItemReadings[] =
    Array.isArray(initialReadings.items) && initialReadings.items.length > 0
      ? (initialReadings.items as ItemReadings[])
      : [{ quantity: 1 }];

  const [techRows, setTechRows] = useState<TechnicianReadings[]>(initialTechs);
  const [itemRows, setItemRows] = useState<ItemReadings[]>(initialItems);

  const missingSet = new Set(missingFields);
  const scalarFields = scalarFieldsForAnyMethod(method);

  return (
    <form action={action} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge>{METHOD_LABEL[method]}</Badge>
          {submittedAt ? (
            missingFields.length === 0 ? (
              <Status tone="ok">Submitted · complete</Status>
            ) : (
              <Status tone="wait">Submitted · {missingFields.length} mandatory missing</Status>
            )
          ) : (
            <Status tone="info">Draft</Status>
          )}
        </div>
      </div>

      {missingFields.length > 0 && (
        <Card>
          <Status tone="bad">
            {missingFields.length} mandatory {missingFields.length === 1 ? "reading is" : "readings are"} still
            missing (X2):
          </Status>
          <ul className="mt-2 list-disc pl-5 text-[13px] text-ink-2">
            {missingFields.map((path) => (
              <li key={path}>{formatMissingFieldLabel(method, path)}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-4">
        <SectionTitle>{METHOD_LABEL[method]} parameters &amp; site details</SectionTitle>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {scalarFields.map((def) => {
            const isMissing = missingSet.has(def.key);
            const val = initialReadings[def.key] as string | number | null | undefined;
            return (
              <div key={def.key} className={def.input === "textarea" ? "sm:col-span-2" : ""}>
                <Field
                  label={`${def.label}${def.required ? " *" : ""}`}
                  hint={isMissing ? "Mandatory reading missing" : undefined}
                >
                  {renderFieldInput(def, def.key, val)}
                </Field>
              </div>
            );
          })}
        </div>
      </Card>

      <input type="hidden" name="technicians_count" value={techRows.length} />
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Testing carried out by</SectionTitle>
          <SecondaryButton
            type="button"
            onClick={() => setTechRows((prev) => [...prev, {}])}
          >
            + Add technician
          </SecondaryButton>
        </div>

        <div className="space-y-4">
          {techRows.map((row, idx) => (
            <div key={idx} className="space-y-3 border-t border-line-2 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-2">Technician #{idx + 1}</span>
                {techRows.length > 1 && (
                  <SecondaryButton
                    type="button"
                    onClick={() => setTechRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </SecondaryButton>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TECHNICIAN_FIELDS.map((def) => {
                  const path = `technicians.${idx}.${def.key}`;
                  const isMissing = missingSet.has(path);
                  return (
                    <Field
                      key={def.key}
                      label={`${def.label}${def.required ? " *" : ""}`}
                      hint={isMissing ? "Mandatory reading missing" : undefined}
                    >
                      {renderFieldInput(def, path, row[def.key])}
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <input type="hidden" name="items_count" value={itemRows.length} />
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Inspected items &amp; observations</SectionTitle>
          <SecondaryButton
            type="button"
            onClick={() => setItemRows((prev) => [...prev, { quantity: 1 }])}
          >
            + Add item
          </SecondaryButton>
        </div>

        <div className="space-y-4">
          {itemRows.map((row, idx) => (
            <div key={idx} className="space-y-3 border-t border-line-2 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-2">Item #{idx + 1}</span>
                {itemRows.length > 1 && (
                  <SecondaryButton
                    type="button"
                    onClick={() => setItemRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </SecondaryButton>
                )}
              </div>
              <div className="grid gap-3">
                {ITEM_FIELDS.map((def) => {
                  const path = `items.${idx}.${def.key}`;
                  const isMissing = missingSet.has(path);
                  return (
                    <Field
                      key={def.key}
                      label={`${def.label}${def.required ? " *" : ""}`}
                      hint={isMissing ? "Mandatory reading missing" : undefined}
                    >
                      {renderFieldInput(def, path, row[def.key])}
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <Field label="Overall summary / additional field notes" hint="Optional note for the technical reviewer">
          <Textarea name="observations" defaultValue={initialObservations ?? ""} />
        </Field>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button type="submit" name="intent" value="submit" className="w-full py-3 text-[15px]">
          Submit {METHOD_LABEL[method]} readings
        </Button>
        <SecondaryButton type="submit" name="intent" value="draft" className="w-full py-3 text-[15px]">
          Save draft
        </SecondaryButton>
      </div>
    </form>
  );
}
