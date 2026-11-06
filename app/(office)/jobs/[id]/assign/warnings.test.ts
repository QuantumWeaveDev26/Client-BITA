import { describe, expect, it } from "vitest";
import {
  checkMethodQualification,
  evaluateTechnicianForJob,
  formatEquipmentLabel,
  isCalibrationOverdue,
  type QualificationRecord,
} from "./warnings";

describe("T5 technician qualification and equipment calibration warnings (R20)", () => {
  const baseRecord: QualificationRecord = {
    person_id: "tech-1",
    method: "UT",
    level: "Level II",
    scheme: "ISNT",
    certificate_no: "ISNT-UT-101",
    valid_until: "2027-06-30",
    is_expired: false,
  };

  it("reports valid when technician holds an active qualification for the method", () => {
    const check = checkMethodQualification("UT", [baseRecord]);
    expect(check.status).toBe("valid");
    expect(check.summary).toContain("UT: Level II · ISNT · ISNT-UT-101 (valid until 2027-06-30)");
  });

  it("reports expired warning when the technician's certificate is expired", () => {
    const expired: QualificationRecord = {
      ...baseRecord,
      method: "MPT",
      certificate_no: "ASNT-MT-202",
      valid_until: "2025-03-15",
      is_expired: true,
    };
    const check = checkMethodQualification("MPT", [expired]);
    expect(check.status).toBe("expired");
    if (check.status !== "valid") {
      expect(check.warning).toContain("Expired qualification for MPT");
      expect(check.warning).toContain("2025-03-15");
    }
  });

  it("reports not_qualified warning when technician has no record for the method", () => {
    const check = checkMethodQualification("DPT", [baseRecord]);
    expect(check.status).toBe("not_qualified");
    if (check.status !== "valid") {
      expect(check.warning).toBe("Not qualified for DPT (no certificate on file).");
    }
  });

  it("prefers a valid certificate over an older expired certificate for the same method", () => {
    const olderExpired: QualificationRecord = {
      ...baseRecord,
      certificate_no: "OLD-01",
      valid_until: "2023-01-01",
      is_expired: true,
    };
    const renewedValid: QualificationRecord = {
      ...baseRecord,
      certificate_no: "NEW-02",
      valid_until: "2028-01-01",
      is_expired: false,
    };
    const check = checkMethodQualification("UT", [olderExpired, renewedValid]);
    expect(check.status).toBe("valid");
    expect(check.record?.certificate_no).toBe("NEW-02");
  });

  it("evaluates all required job methods and collects warnings", () => {
    const records: QualificationRecord[] = [
      baseRecord,
      {
        ...baseRecord,
        method: "MPT",
        certificate_no: "MT-EXP",
        valid_until: "2024-12-31",
        is_expired: true,
      },
    ];
    const result = evaluateTechnicianForJob(["UT", "MPT", "DPT"], records);
    expect(result.allValid).toBe(false);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("Expired qualification for MPT");
    expect(result.warnings[1]).toContain("Not qualified for DPT");
  });

  it("checks equipment calibration overdue against IST date", () => {
    expect(isCalibrationOverdue("2026-11-05", "2026-11-06")).toBe(true);
    expect(isCalibrationOverdue("2026-11-06", "2026-11-06")).toBe(false);
    expect(isCalibrationOverdue("2026-12-01", "2026-11-06")).toBe(false);
    expect(isCalibrationOverdue(null, "2026-11-06")).toBe(false);
  });

  it("formats equipment labels cleanly", () => {
    expect(
      formatEquipmentLabel({
        id: "eq-1",
        kind: "ut_flaw_detector",
        make: "Olympus",
        model: "EPOCH 650",
        serial_no: "SN-9001",
        calibration_due: "2027-01-10",
      }),
    ).toBe("UT flaw detector · Olympus EPOCH 650 · #SN-9001");
  });
});
