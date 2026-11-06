import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Json, Tables } from "../../../lib/db/types";
import { previewDocument } from "../../../templates/reports/preview-data";
import { makeSnapshot } from "../../../lib/reports/review";

const mocks = vi.hoisted(() => ({ context: vi.fn(), access: vi.fn() }));
vi.mock("./access", () => ({ requireReportReviewer: mocks.access }));
vi.mock("./data", () => ({ reportContext: mocks.context }));
vi.mock("@/lib/reports/review", async () => await import("../../../lib/reports/review"));
vi.mock("@/lib/forms", async () => await import("../../../lib/forms"));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`); } }));

import { prepareReport, sendForReview } from "./actions";

const ID = "10000000-0000-0000-0000-000000000001";
function source(): Tables<"inspections"> {
  return { id: ID, job_id: ID, assignment_id: ID, method: "UT", readings: previewDocument("UT").readings as Json, observations: null, submitted_by: ID, submitted_at: "2026-11-06T06:00:00Z", created_at: "2026-11-06T05:00:00Z", missing_fields: [] };
}
function setup(roles = ["management"]) {
  const query = { select: vi.fn(), eq: vi.fn(), contains: vi.fn(), insert: vi.fn(), update: vi.fn(), single: vi.fn(), maybeSingle: vi.fn() };
  for (const key of ["select", "eq", "contains", "insert", "update"] as const) query[key].mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: source(), error: null }); query.single.mockResolvedValue({ data: { id: ID }, error: null });
  const supabase = { from: vi.fn().mockReturnValue(query) };
  const snapshot = makeSnapshot(source());
  mocks.access.mockResolvedValue({ supabase, person: { id: ID, roles } });
  mocks.context.mockResolvedValue({ supabase, person: { id: ID, roles }, report: { id: ID, status: "draft" }, snapshot, sameSource: true, problems: [] });
  return { query, supabase, snapshot };
}
function form() {
  const fd = new FormData(); fd.set("inspection_id", ID); fd.set("report_no", "FAKE/TEST/001"); fd.set("report_date", "2026-11-06"); return fd;
}
beforeEach(() => vi.clearAllMocks());

describe("report preparation and submission", () => {
  it("lets only management enter a new report number", async () => {
    const { supabase } = setup(["reviewer"]);
    await expect(prepareReport(form())).rejects.toThrow("Only%20management"); expect(supabase.from).not.toHaveBeenCalled();
  });
  it("recomputes missing readings rather than trusting an empty stored array", async () => {
    const { query } = setup(); query.maybeSingle.mockResolvedValue({ data: { ...source(), readings: {} }, error: null });
    await expect(prepareReport(form())).rejects.toThrow("Report%20cannot%20be%20prepared"); expect(query.insert).not.toHaveBeenCalled();
  });
  it("creates only a draft from server-loaded readings and records the actual preparer", async () => {
    const { query } = setup(); const fd = form(); fd.set("approved_by", "forged"); fd.set("content", "forged");
    await expect(prepareReport(fd)).rejects.toThrow(`REDIRECT /review/${ID}?saved=1`);
    expect(query.insert.mock.calls[0][0]).toMatchObject({ status: "draft", prepared_by: ID, inspection_id: ID, content: { version: 1 } });
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty("approved_by");
  });
  it("rejects invalid dates before creating any report", async () => {
    const { query } = setup(); const fd = form(); fd.set("report_date", "2026-02-30");
    await expect(prepareReport(fd)).rejects.toThrow("valid%20report%20date"); expect(query.insert).not.toHaveBeenCalled();
  });
  it("refuses stale source data, then uses an optimistic status/hash guard for valid review submission", async () => {
    const { query, snapshot } = setup(); const ctx = await mocks.context();
    mocks.context.mockResolvedValueOnce({ ...ctx, sameSource: false });
    await expect(sendForReview(ID)).rejects.toThrow("Refresh%20this%20draft"); expect(query.update).not.toHaveBeenCalled();
    await expect(sendForReview(ID)).rejects.toThrow(`REDIRECT /review/${ID}?saved=1`);
    expect(query.eq).toHaveBeenCalledWith("status", "draft"); expect(query.contains).toHaveBeenCalledWith("content", { sourceHash: snapshot.sourceHash });
  });
});
