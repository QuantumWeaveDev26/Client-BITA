import { describe, expect, it } from "vitest";
import { buildSearchResponse, moveSearchIndex, sanitizeSearchTerm } from "./search";

describe("global search helpers (T25)", () => {
  it("sanitises filter characters identically to customers/page.tsx", () => {
    expect(sanitizeSearchTerm("  BITA/26-27/0101, (PO%100)* ")).toBe("BITA/26-27/0101 PO 100");
    expect(sanitizeSearchTerm("   ")).toBe("");
    expect(sanitizeSearchTerm(null)).toBe("");
  });

  it("groups results in canonical order and builds a flat keyboard list", () => {
    const res = buildSearchResponse("0101", {
      Reports: [
        { id: "r1", group: "Reports", code: "FAKE/UT/01", title: "UT Report", href: "/review/r1" },
      ],
      Jobs: [
        { id: "j1", group: "Jobs", code: "BITA/26-27/0101", title: "Test Turbines", href: "/jobs/j1" },
      ],
      Customers: [],
    });

    expect(res.groups.map((g) => g.group)).toEqual(["Jobs", "Reports"]);
    expect(res.flat.map((i) => i.id)).toEqual(["j1", "r1"]);
  });

  it("wraps keyboard up/down navigation across flattened search items", () => {
    expect(moveSearchIndex(-1, 1, 3)).toBe(0);
    expect(moveSearchIndex(0, 1, 3)).toBe(1);
    expect(moveSearchIndex(2, 1, 3)).toBe(0);
    expect(moveSearchIndex(0, -1, 3)).toBe(2);
    expect(moveSearchIndex(0, 1, 0)).toBe(-1);
  });
});
