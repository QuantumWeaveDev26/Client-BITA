"use client";

import { Button } from "@/components/ui";

export function PrintQuotationButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
