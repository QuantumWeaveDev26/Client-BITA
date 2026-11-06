import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "./route";

describe("Reminders Plan API Route (POST /api/reminders/plan)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.REMINDERS_CRON_SECRET = "test-secret-12345";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 401 if no secret header is provided", async () => {
    const req = new Request("http://localhost/api/reminders/plan", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 if wrong secret is provided", async () => {
    const req = new Request("http://localhost/api/reminders/plan", {
      method: "POST",
      headers: {
        "x-reminders-cron-secret": "wrong-secret",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts Bearer token in Authorization header", async () => {
    const req = new Request("http://localhost/api/reminders/plan", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-secret-12345",
      },
    });

    // It will proceed past the auth check to Supabase connection
    const res = await POST(req);
    expect(res.status).not.toBe(401);
  });

  it("returns 500 if REMINDERS_CRON_SECRET is not configured on server", async () => {
    delete process.env.REMINDERS_CRON_SECRET;
    const req = new Request("http://localhost/api/reminders/plan", {
      method: "POST",
      headers: {
        "x-reminders-cron-secret": "test-secret-12345",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("REMINDERS_CRON_SECRET is not configured");
  });
});
