import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { GET, POST } from "./[register]/[id]/certificate/route";

const ID = "20000000-0000-0000-0000-000000000001";
const PERSON = "10000000-0000-0000-0000-000000000001";
const request = new Request("http://localhost/registers/equipment/test/certificate");
function context(register = "equipment", id = ID) { return { params: Promise.resolve({ register, id }) }; }

function setup(path: string | null, options: { hidden?: boolean; error?: boolean } = {}) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), single: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.update.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: options.hidden ? null : { certificate_path: path, person_id: PERSON }, error: options.error ? { message: "Test database error" } : null });
  query.single.mockResolvedValue({ data: { id: ID }, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.test/private-certificate" }, error: null });
  const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
  const supabase = { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ createSignedUrl, upload }) } };
  mocks.requireUser.mockResolvedValue({ supabase, person: { roles: ["management"] } });
  return { supabase, createSignedUrl, query, upload };
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

function uploadRequest(options: { origin?: string; size?: number; type?: string; headers?: Record<string, string> } = {}) {
  const fd = new FormData();
  fd.set("certificate", new File([new Uint8Array(options.size ?? 20)], "test.pdf", { type: options.type ?? "application/pdf" }));
  return new Request(`http://localhost/registers/equipment/${ID}/certificate`, {
    method: "POST", headers: { origin: options.origin ?? "http://localhost", ...options.headers }, body: fd,
  });
}

describe("management certificate uploads", () => {
  it("rejects cross-origin posts before authenticating or writing", async () => {
    setup(null);
    const response = await POST(uploadRequest({ origin: "https://other.example.test" }), context());
    expect(response.status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("rejects office users before accepting uploads", async () => {
    const { supabase, upload } = setup(null);
    mocks.requireUser.mockResolvedValue({ supabase, person: { roles: ["office"] } });
    expect((await POST(uploadRequest(), context())).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("checks RLS visibility before uploading", async () => {
    const { upload } = setup(null, { hidden: true });
    expect((await POST(uploadRequest(), context())).status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads a file larger than 1 MB through the route and links only its record directory", async () => {
    const { upload, query, supabase } = setup(null);
    const response = await POST(uploadRequest({ size: 1024 * 1024 + 1 }), context());
    expect(response.headers.get("location")).toContain("?saved=1");
    expect(supabase.storage.from).toHaveBeenCalledWith("documents");
    expect(upload.mock.calls[0][0]).toMatch(new RegExp(`^calibration/${ID}/[a-f0-9-]+\\.pdf$`));
    expect(query.update).toHaveBeenCalledWith({ certificate_path: upload.mock.calls[0][0] });
  });

  it("rejects unsupported files and oversized declared bodies without storage writes", async () => {
    for (const options of [{ type: "text/html" }, { headers: { "content-length": String(6 * 1024 * 1024) } }]) {
      const { upload } = setup(null);
      const response = await POST(uploadRequest(options), context());
      expect(response.headers.get("location")).toContain("?error=");
      expect(upload).not.toHaveBeenCalled();
    }
  });

  it("bounds an oversized multipart stream even without a Content-Length header", async () => {
    const { upload } = setup(null);
    const response = await POST(uploadRequest({ size: 6 * 1024 * 1024 }), context());
    expect(response.headers.get("location")).toContain("5+MB");
    expect(upload).not.toHaveBeenCalled();
  });

  it("keeps the existing copy linked when storage upload fails", async () => {
    const { upload, query } = setup(`calibration/${ID}/existing.pdf`);
    upload.mockResolvedValue({ error: { message: "Test upload failure" } });
    const response = await POST(uploadRequest(), context());
    expect(response.headers.get("location")).toContain("error=");
    expect(query.update).not.toHaveBeenCalled();
  });
});
