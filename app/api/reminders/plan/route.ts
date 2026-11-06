import { todayIST } from "../../../../lib/dates";
import type { Database } from "../../../../lib/db/types";
import { planAndInsertReminders } from "../../../../lib/reminders/plan";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Validate authorization
  const expectedSecret = process.env.REMINDERS_CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "REMINDERS_CRON_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader =
    req.headers.get("x-reminders-cron-secret") ||
    req.headers.get("authorization");

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token || !sameSecret(token, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase service role credentials not configured" },
      { status: 500 },
    );
  }

  // Parse optional target date from body (defaulting to today in IST)
  let targetDate = todayIST();
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      targetDate = body.date;
    }
  } catch {
    // Body optional
  }

  try {
    const supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const result = await planAndInsertReminders(supabaseAdmin, targetDate);

    return NextResponse.json({
      ok: true,
      ...result,
      note: "Sending reminder emails waits for Stage 2 mailbox access.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Compares secrets in constant time, so response timing reveals nothing about the secret.
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
