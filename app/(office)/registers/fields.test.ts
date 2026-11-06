import { describe, expect, it } from "vitest";
import { calibrationStatus, certificateError, equipmentFields, indiaToday, MAX_CERTIFICATE_BYTES, personFields, qualificationFields } from "./fields";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

const PERSON = "10000000-0000-0000-0000-000000000001";

describe("register validation", () => {
  it("requires a name and rejects forged roles", () => {
    expect(() => personFields(form({ full_name: "   " }))).toThrow("Name is required");
    expect(() => personFields(form({ full_name: "Test Technician", roles: "admin" }))).toThrow("valid role");
    const fd = form({ full_name: " Test Technician ", initials: "tt", active: "on" });
    fd.append("roles", "technician");
    fd.append("roles", "technician");
    expect(personFields(fd)).toMatchObject({ full_name: "Test Technician", initials: "TT", roles: ["technician"], active: true });
  });

  it("validates person ids, method and level before saving qualifications", () => {
    expect(() => qualificationFields(form({ person_id: "../person", method: "UT", level: "II" }))).toThrow("Choose a person");
    expect(() => qualificationFields(form({ person_id: PERSON, method: "invalid", level: "II" }))).toThrow("test method");
    expect(() => qualificationFields(form({ person_id: PERSON, method: "UT", level: " " }))).toThrow("Level is required");
  });

  it("rejects nonexistent dates and reversed certificate validity", () => {
    expect(() => qualificationFields(form({ person_id: PERSON, method: "UT", level: "II", issued_on: "2026-02-30" }))).toThrow("valid date");
    expect(() => qualificationFields(form({ person_id: PERSON, method: "UT", level: "II", issued_on: "2026-11-06", valid_until: "2026-11-05" }))).toThrow("cannot be before");
    expect(qualificationFields(form({ person_id: PERSON, method: "MPT", level: "II" })).valid_until).toBeNull();
  });

  it("rejects forged equipment kinds and reversed calibration dates", () => {
    expect(() => equipmentFields(form({ kind: "invalid" }))).toThrow("equipment kind");
    expect(() => equipmentFields(form({ kind: "mpi_yoke", calibrated_on: "2026-11-06", calibration_due: "2026-11-05" }))).toThrow("cannot be before");
    expect(equipmentFields(form({ kind: "mpi_yoke" }))).toMatchObject({ calibration_due: null, active: false });
  });
});

describe("calibration warnings", () => {
  it("treats missing dates as unknown and the due date as due soon", () => {
    expect(calibrationStatus(null, "2026-11-06")).toBe("Date not recorded");
    expect(calibrationStatus("2026-11-05", "2026-11-06")).toBe("Overdue");
    expect(calibrationStatus("2026-11-06", "2026-11-06")).toBe("Due within 30 days");
  });

  it("includes exactly 30 days, excluding day 31 across month and year boundaries", () => {
    expect(calibrationStatus("2026-12-06", "2026-11-06")).toBe("Due within 30 days");
    expect(calibrationStatus("2026-12-07", "2026-11-06")).toBe("In date");
    expect(calibrationStatus("2027-01-01", "2026-12-02")).toBe("Due within 30 days");
  });

  it("uses India midnight even while the UTC date is still yesterday", () => {
    expect(indiaToday(new Date("2026-11-05T18:29:59Z"))).toBe("2026-11-05");
    expect(indiaToday(new Date("2026-11-05T18:30:00Z"))).toBe("2026-11-06");
  });
});

describe("certificate upload limits", () => {
  it("accepts supported types up to the limit and rejects oversized or unsupported content types", () => {
    expect(certificateError({ size: MAX_CERTIFICATE_BYTES, type: "application/pdf" })).toBeNull();
    expect(certificateError({ size: MAX_CERTIFICATE_BYTES + 1, type: "image/png" })).toContain("5 MB");
    expect(certificateError({ size: 20, type: "text/html" })).toContain("PDF, JPEG or PNG");
    expect(certificateError({ size: 20, type: "constructor" })).toContain("PDF, JPEG or PNG");
  });
});
