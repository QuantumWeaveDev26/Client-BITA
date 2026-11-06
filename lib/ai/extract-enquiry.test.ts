import { describe, expect, it, vi } from "vitest";
import { extractEnquiry } from "./extract-enquiry";
import {
  isExtractedEnquiry,
  normalizeExtractedEnquiry,
  normalizeTestMethod,
  normalizeUrgency,
} from "./types";

describe("lib/ai/types helpers", () => {
  it("normalizes test method synonyms to canonical enum values", () => {
    expect(normalizeTestMethod("UT")).toBe("UT");
    expect(normalizeTestMethod("Ultrasonic Testing")).toBe("UT");
    expect(normalizeTestMethod("MT")).toBe("MPT");
    expect(normalizeTestMethod("MPI")).toBe("MPT");
    expect(normalizeTestMethod("PT")).toBe("DPT");
    expect(normalizeTestMethod("DP")).toBe("DPT");
    expect(normalizeTestMethod("Dye Penetrant")).toBe("DPT");
    expect(normalizeTestMethod("RT")).toBe("RT");
    expect(normalizeTestMethod("X-ray")).toBe("RT");
    expect(normalizeTestMethod("VT")).toBe("VT");
    expect(normalizeTestMethod("Visual Testing")).toBe("VT");
    expect(normalizeTestMethod("hardness")).toBe("hardness");
    expect(normalizeTestMethod("metallography")).toBe("metallography");
    expect(normalizeTestMethod("RLA")).toBe("RLA");
    expect(normalizeTestMethod("certification")).toBe("certification");
    expect(normalizeTestMethod("general_inspection")).toBe("general_inspection");
    expect(normalizeTestMethod("INVALID_TEST")).toBeNull();
  });

  it("normalizes urgency levels", () => {
    expect(normalizeUrgency("urgent")).toBe("urgent");
    expect(normalizeUrgency("URGENT")).toBe("urgent");
    expect(normalizeUrgency("asap")).toBe("urgent");
    expect(normalizeUrgency("normal")).toBe("normal");
    expect(normalizeUrgency("standard")).toBe("normal");
    expect(normalizeUrgency("low")).toBe("low");
    expect(normalizeUrgency("unknown")).toBeNull();
    expect(normalizeUrgency(null)).toBeNull();
  });

  it("validates and normalizes parsed enquiry objects", () => {
    const raw = {
      customer_hint: " Acme Turbines Ltd ",
      contact_name: " Alice QA ",
      component: " Rotor shaft ",
      quantity: "4",
      test_methods: ["UT", "MT", "invalid_thing"],
      site: " Plant A ",
      urgency: "urgent",
      summary: " Urgent UT on shafts. ",
    };

    const normalized = normalizeExtractedEnquiry(raw);
    expect(normalized).not.toBeNull();
    expect(normalized).toEqual({
      customer_hint: "Acme Turbines Ltd",
      contact_name: "Alice QA",
      component: "Rotor shaft",
      quantity: 4,
      test_methods: ["UT", "MPT"],
      site: "Plant A",
      urgency: "urgent",
      summary: "Urgent UT on shafts.",
    });
    expect(isExtractedEnquiry(normalized)).toBe(true);
  });

  it("rejects non-object or malformed structures in normalizeExtractedEnquiry", () => {
    expect(normalizeExtractedEnquiry(null)).toBeNull();
    expect(normalizeExtractedEnquiry("string")).toBeNull();
    expect(normalizeExtractedEnquiry([1, 2, 3])).toBeNull();
  });
});

describe("extractEnquiry", () => {
  it("returns null immediately when subject and body are empty", async () => {
    const mockFetch = vi.fn();
    const result = await extractEnquiry(
      { subject: "", body: "   ", sender: "test@example.com" },
      { apiKey: "test-key", fetchFn: mockFetch as unknown as typeof fetch }
    );
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null immediately when ANTHROPIC_API_KEY is not set", async () => {
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const mockFetch = vi.fn();
      const result = await extractEnquiry(
        { subject: "Urgent inspection", body: "Need UT tomorrow" },
        { apiKey: "", fetchFn: mockFetch as unknown as typeof fetch }
      );
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      if (origKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = origKey;
      }
    }
  });

  it("calls Anthropic API with expected model, headers and payload", async () => {
    const mockResponsePayload = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            customer_hint: "Demo Heavy Eng",
            contact_name: "John Doe",
            component: "Gear Pinions",
            quantity: 10,
            test_methods: ["MPT"],
            site: "Peenya",
            urgency: "normal",
            summary: "Quote needed for MPT testing of 10 gear pinions.",
          }),
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponsePayload,
    });

    const result = await extractEnquiry(
      {
        sender: "john@demoheavy.test",
        subject: "Quote for MPI testing",
        body: "Please send quote for testing 10 gear pinions at Peenya next week.",
      },
      {
        apiKey: "fake-anthropic-key",
        model: "claude-sonnet-5-5",
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": "fake-anthropic-key",
      "anthropic-version": "2023-06-01",
    });

    const parsedBody = JSON.parse(requestInit.body as string);
    expect(parsedBody.model).toBe("claude-sonnet-5-5");
    expect(parsedBody.max_tokens).toBe(1024);
    expect(parsedBody.messages[0].role).toBe("user");
    expect(parsedBody.messages[0].content).toContain("Sender: john@demoheavy.test");

    expect(result).toEqual({
      customer_hint: "Demo Heavy Eng",
      contact_name: "John Doe",
      component: "Gear Pinions",
      quantity: 10,
      test_methods: ["MPT"],
      site: "Peenya",
      urgency: "normal",
      summary: "Quote needed for MPT testing of 10 gear pinions.",
    });
  });

  it("strips markdown code blocks from Claude response", async () => {
    const jsonString = JSON.stringify({
      customer_hint: "Test Valve Corp",
      contact_name: null,
      component: "Gate valves",
      quantity: 2,
      test_methods: ["UT", "DPT"],
      site: "Site A",
      urgency: "urgent",
      summary: "Urgent UT and DPT testing on gate valves.",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            type: "text",
            text: `\`\`\`json\n${jsonString}\n\`\`\``,
          },
        ],
      }),
    });

    const result = await extractEnquiry(
      {
        subject: "Urgent DPT and UT for 2 gate valves",
        body: "Please visit tomorrow for testing.",
      },
      {
        apiKey: "fake-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(result).toEqual({
      customer_hint: "Test Valve Corp",
      contact_name: null,
      component: "Gate valves",
      quantity: 2,
      test_methods: ["UT", "DPT"],
      site: "Site A",
      urgency: "urgent",
      summary: "Urgent UT and DPT testing on gate valves.",
    });
  });

  it("returns null gracefully when API returns HTTP error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized: Invalid API key",
    });

    const result = await extractEnquiry(
      { subject: "Testing", body: "Need quote" },
      {
        apiKey: "bad-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(result).toBeNull();
  });

  it("returns null gracefully when network fetch throws", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const result = await extractEnquiry(
      { subject: "Testing", body: "Need quote" },
      {
        apiKey: "any-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(result).toBeNull();
  });

  it("returns null gracefully when response is malformed JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            type: "text",
            text: "Sorry, I am unable to extract information.",
          },
        ],
      }),
    });

    const result = await extractEnquiry(
      { subject: "Testing", body: "Need quote" },
      {
        apiKey: "any-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(result).toBeNull();
  });
});
