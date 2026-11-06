import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
import { GET } from "./[register]/[id]/certificate/route";

const ID = "20000000-0000-0000-0000-000000000001";
const PERSON = "10000000-0000-0000-0000-000000000001";
const request = new Request("http://localhost/registers/equipment/test/certificate");
function context(register = "equipment", id = ID) { return { params: Promise.resolve({ register, id }) }; }

function setup(path: string | null, options: { hidden?: boolean; error?: boolean } = {}) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: options.hidden ? null : { certificate_path: path, person_id: PERSON }, error: options.error ? { message: "Test database error" } : null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.test/private-certificate" }, error: null });
  const supabase = { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } };
  mocks.requireUser.mockResolvedValue({ supabase });
  return { supabase, createSignedUrl, query };
}

beforeEach(() => vi.clearAllMocks());

describe("private certificate downloads", () => {
  it("rejects invalid record kinds and ids before querying storage", async () => {
    expect((await GET(request, context("people"))).status).toBe(404);
    expect((await GET(request, context("equipment", "../other"))).status).toBe(404);
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("does not sign missing records hidden by RLS", async () => {
    const { createSignedUrl } = setup(null, { hidden: true });
    expect((await GET(request, context())).status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("refuses paths belonging to another record or containing traversal", async () => {
    for (const path of [`calibration/${PERSON}/test.pdf`, `calibration/${ID}/../test.pdf`]) {
      const { createSignedUrl } = setup(path);
      expect((await GET(request, context())).status).toBe(404);
      expect(createSignedUrl).not.toHaveBeenCalled();
    }
  });

  it("signs the stored equipment path for 60 seconds with a non-cacheable redirect", async () => {
    const path = `calibration/${ID}/test.pdf`;
    const { createSignedUrl, query, supabase } = setup(path);
    const response = await GET(request, context());
    expect(query.eq).toHaveBeenCalledWith("id", ID);
    expect(supabase.storage.from).toHaveBeenCalledWith("documents");
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60, { download: true });
    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("uses the qualification's person directory, not its record id", async () => {
    const path = `certificates/${PERSON}/test.pdf`;
    const { createSignedUrl } = setup(path);
    expect((await GET(request, context("qualifications"))).status).toBe(303);
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60, { download: true });
  });

  it("shows a recoverable failure rather than 'not found' on a database outage", async () => {
    setup(null, { error: true });
    expect((await GET(request, context())).status).toBe(503);
  });
});
