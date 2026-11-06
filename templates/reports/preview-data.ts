import type { ReportMethod } from "../../lib/reports/fields";
import type { ReportDocument } from "./types";

/** Invented data only. No original report values, logos, signatures, seals or customer details. */
export function previewDocument(method: ReportMethod): ReportDocument {
  return {
    reportNumber: `FAKE/${method}/0001`, reportDate: "2026-11-06",
    letterhead: { name: "EXAMPLE INSPECTION AGENCY", addressLines: ["1 Example Road, Test City 000000"], contactLines: ["reports@example.test"] },
    approval: { approved: false },
    readings: {
      client: "FAKE TEST Customer", project: "FAKE TEST Project", inspection_site: "Example test workshop", inspection_date: "2026-11-06",
      equipment: "Demo test instrument", equipment_serial: "FAKE-EQ-001", probes: "Test probe specification",
      reference_blocks: "Test reference block", screen_range: "0–100 mm (fake)", sensitivity: "Test sensitivity",
      scanning_level: "Test scanning level", couplant: "Test couplant", surface_condition: "Test surface condition",
      standard: "FAKE TEST standard", acceptance_criteria: "FAKE TEST criteria",
      magnetic_medium: "Test magnetic medium", magnetisation_method: "Test magnetisation method", current: "Test current",
      visible_light_intensity: "0 lux (fake)", black_light: "Demo light device", black_light_intensity: "Test intensity",
      test_block: "Test block", yoke_lifting_capacity: "Test capacity",
      component_description: "FAKE TEST component", cleaner: "Demo cleaner", cleaner_batch: "FAKE-C-001",
      penetrant: "Demo penetrant", penetrant_batch: "FAKE-P-001", developer: "Demo developer", developer_batch: "FAKE-D-001",
      dwell_time: "10 minutes (fake)", developing_time: "7 minutes (fake)",
      technicians: [{ name: "FAKE TEST Inspector", qualification: `Test Level II ${method}`, certificate_no: "FAKE-CERT-001", issued_on: "2026-01-01", valid_until: "2027-01-01" }],
      items: [{ description: "FAKE TEST component\nDrawing: FAKE-DRAWING-001\nJob: FAKE-JOB-001", quantity: 1, observations: "FAKE DATA — layout preview only. These are not inspection results or an acceptance decision." }],
    },
    footerNotes: ["FAKE DATA — FORMAT PREVIEW ONLY — NOT AN INSPECTION REPORT"],
  };
}
