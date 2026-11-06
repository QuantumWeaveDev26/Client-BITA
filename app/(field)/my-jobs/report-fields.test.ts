import { describe, expect, it } from "vitest";
import { formatMissingFieldLabel, missingFields } from "./report-fields";

describe("T7 mandatory reading checks per BITA Table 4.4 (X2)", () => {
  const completeTech = {
    name: "R. Kumar",
    qualification: "ISNT Level II",
    certificate_no: "ISNT-UT-881",
    issued_on: "2023-04-01",
    valid_until: "2028-03-31",
  };

  const completeItem = {
    description: "Main steam header weld seam W-12",
    quantity: 1,
    observations: "No recordable indications found; acceptable per ASME Sec VIII Div 1.",
  };

  it("returns no missing fields when all mandatory UT readings are supplied", () => {
    const readings = {
      client: "Peenya Forge Pvt Ltd",
      project: "Boiler drum overhaul",
      inspection_site: "Peenya Stage II",
      inspection_date: "2026-11-06",
      equipment: "Olympus EPOCH 650",
      equipment_serial: "EP650-112",
      probes: "4 MHz Normal & 45 deg",
      reference_blocks: "IIW V1 & V2",
      screen_range: "0-200 mm",
      sensitivity: "DAC + 6 dB",
      scanning_level: "Reference + 6 dB",
      couplant: "Grease",
      surface_condition: "Ground smooth",
      standard: "ASME Sec V Art 4",
      acceptance_criteria: "ASME Sec VIII Div 1",
      technicians: [completeTech],
      items: [completeItem],
    };
    expect(missingFields("UT", readings)).toEqual([]);
  });

  it("flags missing scalar and array fields with dotted paths for MPT", () => {
    const readings = {
      client: "Peenya Forge Pvt Ltd",
      project: "",
      inspection_site: "Peenya",
      inspection_date: "2026-11-06",
      equipment: "Magnaflux Y-7",
      equipment_serial: "",
      magnetic_medium: "Wet fluorescent",
      standard: "ASME Sec V Art 7",
      magnetisation_method: "Continuous yoke",
      current: "AC",
      visible_light_intensity: "1100 Lux",
      // black_light is optional
      black_light_intensity: "1200 uW/cm2",
      test_block: "Pie gauge",
      yoke_lifting_capacity: "4.5 kg",
      technicians: [{ ...completeTech, certificate_no: "   " }],
      items: [{ description: "Shaft fillet", quantity: 2, observations: "" }],
    };
    const missing = missingFields("MPT", readings);
    expect(missing).toEqual([
      "project",
      "equipment_serial",
      "technicians.0.certificate_no",
      "items.0.observations",
    ]);
    expect(formatMissingFieldLabel("MPT", "technicians.0.certificate_no")).toBe(
      "Technician #1: Certificate number",
    );
    expect(formatMissingFieldLabel("MPT", "items.0.observations")).toBe(
      "Item #1: Observations / remarks",
    );
  });

  it("checks DPT batch numbers and dwell/developing times", () => {
    const missing = missingFields("DPT", {
      client: "Test Client",
      project: "Valve body",
      inspection_site: "Bommasandra",
      inspection_date: "2026-11-06",
      component_description: "CF8M casting",
      cleaner: "Magnaflux SKC-S",
      cleaner_batch: "",
      penetrant: "SKL-SP2",
      penetrant_batch: "B-12",
      developer: "SKD-S2",
      developer_batch: "B-19",
      standard: "ASME Sec V Art 6",
      dwell_time: "15 min",
      developing_time: "",
      technicians: [completeTech],
      items: [completeItem],
    });
    expect(missing).toEqual(["cleaner_batch", "developing_time"]);
  });
});
