import { describe, expect, it } from "vitest";
import { previewDocument } from "../../templates/reports/preview-data";
import type { Json, Tables } from "../db/types";
import { brandingRecord, inspectionHash, inspectionProblems, makeSnapshot, readSnapshot, recipients, reportFilePath } from "./review";

const ID = "10000000-0000-0000-0000-000000000001";
function inspection(): Tables<"inspections"> {
  return { id: ID, job_id: ID, assignment_id: ID, method: "UT", readings: previewDocument("UT").readings as Json, observations: null, submitted_by: ID, submitted_at: "2026-11-06T06:00:00Z", created_at: "2026-11-06T05:00:00Z", missing_fields: [] };
}

describe("report preparation and version checks", () => {
  it("requires submitted complete readings, recomputing rather than trusting stored missing_fields", () => {
    const source = inspection();
    expect(inspectionProblems(source)).toEqual([]);
    expect(() => makeSnapshot({ ...source, submitted_at: null })).toThrow("not been submitted");
    expect(() => makeSnapshot({ ...source, readings: {} })).toThrow("client");
    expect(() => makeSnapshot({ ...source, missing_fields: ["legacy_missing"] })).toThrow("legacy_missing");
  });
  it("preserves a deterministic snapshot fingerprint across JSON key order but detects every source edit", () => {
    const source = inspection();
    const reordered = Object.fromEntries(Object.entries(source.readings as object).reverse()) as Json;
    expect(inspectionHash({ ...source, readings: reordered })).toBe(inspectionHash(source));
    expect(inspectionHash({ ...source, observations: "Corrected test observations" })).not.toBe(inspectionHash(source));
    expect(inspectionHash({ ...source, submitted_at: "2026-11-06T07:00:00Z" })).not.toBe(inspectionHash(source));
    expect(readSnapshot(makeSnapshot(source) as unknown as Json)?.sourceHash).toBe(inspectionHash(source));
    expect(readSnapshot({ readings: {} })).toBeNull();
  });
  it("blocks methods without a paper layout", () => expect(inspectionProblems({ ...inspection(), method: "VT" })[0]).toContain("Unsupported"));
});

describe("safe PDF paths and recipients", () => {
  it("keeps BITA report numbering slashes but refuses traversal or invalid job ids", () => {
    expect(reportFilePath(ID, "FAKE/TEST/0001")).toBe(`reports/${ID}/FAKE/TEST/0001.pdf`);
    for (const value of ["../other", "FAKE/../x", "FAKE//x", "FAKE/", "FAKE\\x"]) expect(() => reportFilePath(ID, value)).toThrow();
    expect(() => reportFilePath("other", "FAKE")).toThrow();
  });
  it("normalizes manual recipient lists and rejects an empty or malformed list", () => {
    expect(recipients(" Test@Example.test; test@example.test,second@example.test")).toEqual(["test@example.test", "second@example.test"]);
    expect(() => recipients("")).toThrow("valid recipient");
    expect(() => recipients("bad\r\nBcc: other@example.test")).toThrow("valid recipient");
  });
  it("validates private branding configuration without accepting external URLs", () => {
    expect(brandingRecord({ name: "Fake Agency", addressLines: ["Example address"], sealPath: "fake/seal.png" }).name).toBe("Fake Agency");
    expect(() => brandingRecord({ name: "Fake", addressLines: [], sealPath: "https://example.test/seal.png" })).toThrow();
    expect(() => brandingRecord({ name: "Fake", addressLines: ["Fake"], sealPath: "../secret" })).toThrow();
  });
});
