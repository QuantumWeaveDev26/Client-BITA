import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/forms", async () => await import("../../../lib/forms"));

import { saveRegister } from "./actions";

const PERSON = "10000000-0000-0000-0000-000000000001";
const EQUIPMENT = "20000000-0000-0000-0000-000000000001";

function database(roles = ["management"]) {
  const query = {
    insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
  };
  for (const name of ["insert", "update", "eq", "select"] as const) query[name].mockReturnValue(query);
  query.single.mockResolvedValue({ data: { id: EQUIPMENT }, error: null });
  query.maybeSingle.mockResolvedValue({ data: { person_id: PERSON }, error: null });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const supabase = { from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ upload }) } };
  mocks.requireUser.mockResolvedValue({ supabase, person: { id: PERSON, roles } });
  return { query, supabase, upload };
}

function equipmentForm(withFile = false) {
  const fd = new FormData(); fd.set("kind", "mpi_yoke"); fd.set("active", "on");
  if (withFile) fd.set("certificate", new File(["%PDF-1.4 fake test certificate"], "test.pdf", { type: "application/pdf" }));
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("management-only register saves", () => {
  it("blocks office users before database writes or uploads", async () => {
    const { supabase } = database(["office"]);
    await expect(saveRegister("equipment", "new", equipmentForm(true))).rejects.toThrow("Only%20management");
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("does not report a successful save when RLS hides the updated row", async () => {
    const { query } = database();
    query.single.mockResolvedValue({ data: null, error: { message: "row-level security" } });
    await expect(saveRegister("equipment", EQUIPMENT, equipmentForm())).rejects.toThrow("You%20do%20not%20have%20permission");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a partial save and preserves the existing certificate link when upload fails", async () => {
    const { query, upload } = database();
    upload.mockResolvedValue({ error: { message: "storage unavailable" } });
    await expect(saveRegister("equipment", EQUIPMENT, equipmentForm(true))).rejects.toThrow("Details%20saved%2C%20but%20the%20certificate%20upload%20failed");
    expect(query.update).toHaveBeenCalledTimes(1);
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("certificate_path");
  });

  it("uploads to the equipment's own private directory before linking the certificate", async () => {
    const { query, upload, supabase } = database();
    await expect(saveRegister("equipment", EQUIPMENT, equipmentForm(true))).rejects.toThrow(`REDIRECT /registers/equipment/${EQUIPMENT}?saved=1`);
    expect(supabase.storage.from).toHaveBeenCalledWith("documents");
    expect(upload.mock.calls[0][0]).toMatch(new RegExp(`^calibration/${EQUIPMENT}/[a-f0-9-]+\\.pdf$`));
    expect(query.update.mock.calls[1][0]).toEqual({ certificate_path: upload.mock.calls[0][0] });
  });

  it("prevents accidental self-deactivation while editing roles", async () => {
    const { supabase } = database();
    const fd = new FormData(); fd.set("full_name", "Test Manager"); fd.set("roles", "management");
    await expect(saveRegister("people", PERSON, fd)).rejects.toThrow("cannot%20deactivate%20yourself");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
