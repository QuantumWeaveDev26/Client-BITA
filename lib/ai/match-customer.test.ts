import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { matchCustomer, matchCustomerInMemory } from "./match-customer";

describe("matchCustomerInMemory", () => {
  const sampleData = {
    customers: [
      { id: "cust-1", name: "Apex Power Systems Pvt Ltd" },
      { id: "cust-2", name: "Bharat Gear Technologies" },
      { id: "cust-3", name: "Southern Valve Forge" },
    ],
    contacts: [
      { customer_id: "cust-1", email: "procurement@apexpower.test", mobile: "+91 98765 43210" },
      { customer_id: "cust-2", email: "quality@bharatgear.test", mobile: "9876500001" },
    ],
  };

  it("matches contact by email address (case-insensitive)", () => {
    const result = matchCustomerInMemory(
      { senderEmail: "PROCUREMENT@apexpower.test" },
      sampleData
    );
    expect(result).toBe("cust-1");
  });

  it("extracts email from sender string when senderEmail is not explicitly provided", () => {
    const result = matchCustomerInMemory(
      { sender: "quality@bharatgear.test" },
      sampleData
    );
    expect(result).toBe("cust-2");
  });

  it("matches contact by phone number ignoring spaces and prefixes", () => {
    const result = matchCustomerInMemory(
      { senderPhone: "9876543210" },
      sampleData
    );
    expect(result).toBe("cust-1");
  });

  it("extracts phone number from sender string", () => {
    const result = matchCustomerInMemory(
      { sender: "+91 98765 00001" },
      sampleData
    );
    expect(result).toBe("cust-2");
  });

  it("prioritizes contact email match over customer hint", () => {
    const result = matchCustomerInMemory(
      {
        senderEmail: "procurement@apexpower.test",
        customerHint: "Bharat Gear", // points to cust-2
      },
      sampleData
    );
    expect(result).toBe("cust-1");
  });

  it("falls back to customer hint when no contact matches", () => {
    const result = matchCustomerInMemory(
      {
        senderEmail: "unknown@freemail.test",
        customerHint: "Valve Forge",
      },
      sampleData
    );
    expect(result).toBe("cust-3");
  });

  it("matches customer hint case-insensitively with partial substring", () => {
    const result = matchCustomerInMemory(
      {
        customerHint: "gear",
      },
      sampleData
    );
    expect(result).toBe("cust-2");
  });

  it("returns null when neither contact nor customer hint matches", () => {
    const result = matchCustomerInMemory(
      {
        senderEmail: "stranger@unknown.test",
        senderPhone: "1234567890",
        customerHint: "Nonexistent Enterprise",
      },
      sampleData
    );
    expect(result).toBeNull();
  });

  it("returns null when input fields are empty or blank", () => {
    expect(matchCustomerInMemory({}, sampleData)).toBeNull();
    expect(matchCustomerInMemory({ sender: "   ", customerHint: "" }, sampleData)).toBeNull();
  });
});

describe("matchCustomer (Supabase client)", () => {
  it("matches contact by email via Supabase query", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { customer_id: "cust-101" },
      error: null,
    });

    const mockIlike = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });

    const mockSelect = vi.fn().mockReturnValue({
      ilike: mockIlike,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "customer_contacts") {
        return { select: mockSelect };
      }
      return { select: vi.fn() };
    });

    const mockSupabase = {
      from: mockFrom,
    } as unknown as SupabaseClient<Database>;

    const result = await matchCustomer(mockSupabase, {
      senderEmail: "buyer@turbines.test",
    });

    expect(result).toBe("cust-101");
    expect(mockFrom).toHaveBeenCalledWith("customer_contacts");
    expect(mockSelect).toHaveBeenCalledWith("customer_id");
    expect(mockIlike).toHaveBeenCalledWith("email", "buyer@turbines.test");
  });

  it("matches contact by mobile phone number via Supabase query", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { customer_id: "cust-202" },
      error: null,
    });

    const mockIlike = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });

    const mockSelect = vi.fn().mockReturnValue({
      ilike: mockIlike,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "customer_contacts") {
        return { select: mockSelect };
      }
      return { select: vi.fn() };
    });

    const mockSupabase = {
      from: mockFrom,
    } as unknown as SupabaseClient<Database>;

    const result = await matchCustomer(mockSupabase, {
      sender: "+91 91234 56789",
    });

    expect(result).toBe("cust-202");
    expect(mockIlike).toHaveBeenCalledWith("mobile", "%9123456789%");
  });

  it("falls back to matching customerHint against customers table when contact is not found", async () => {
    const mockContactMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const mockCustomerMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "cust-303" },
      error: null,
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "customer_contacts") {
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: mockContactMaybeSingle,
              }),
            }),
          }),
        };
      }
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: mockCustomerMaybeSingle,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const mockSupabase = {
      from: mockFrom,
    } as unknown as SupabaseClient<Database>;

    const result = await matchCustomer(mockSupabase, {
      senderEmail: "unknown@freemail.test",
      customerHint: "Karnataka Valves",
    });

    expect(result).toBe("cust-303");
    expect(mockFrom).toHaveBeenCalledWith("customers");
  });

  it("sanitizes special characters in customerHint", async () => {
    const mockCustomerMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "cust-404" },
      error: null,
    });

    const mockIlike = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: mockCustomerMaybeSingle,
        }),
      }),
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnValue({
            ilike: mockIlike,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      };
    });

    const mockSupabase = {
      from: mockFrom,
    } as unknown as SupabaseClient<Database>;

    const result = await matchCustomer(mockSupabase, {
      customerHint: "Karnataka% (Valves)_Corp,",
    });

    expect(result).toBe("cust-404");
    expect(mockIlike).toHaveBeenCalledWith("name", "%Karnataka ValvesCorp%");
  });

  it("returns null when no contact or customer matches in the database", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const mockSupabase = {
      from: mockFrom,
    } as unknown as SupabaseClient<Database>;

    const result = await matchCustomer(mockSupabase, {
      senderEmail: "nobody@nowhere.test",
      customerHint: "Phantom LLC",
    });

    expect(result).toBeNull();
  });
});
