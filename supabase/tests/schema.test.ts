// Runs the migrations in an in-memory Postgres (PGlite) with a minimal stand-in for Supabase's auth schema,
// then checks the business rules the database enforces. Test data only.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "migrations");

const SUPABASE_STANDIN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const OFFICE = "00000000-0000-0000-0000-00000000000a";
const REVIEWER = "00000000-0000-0000-0000-00000000000b";
const OUTSIDER = "00000000-0000-0000-0000-00000000000c";

let db: PGlite;

// Run SQL as a logged-in Supabase user (RLS applies), or as the server's service role.
async function as<T>(userId: string | "service", sql: string, params: unknown[] = []) {
  await db.exec(
    userId === "service"
      ? "set role service_role; select set_config('request.jwt.claim.sub', '', false);"
      : `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDIN);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id) values ('${OFFICE}'), ('${REVIEWER}'), ('${OUTSIDER}');
    insert into people (id, full_name, user_id, roles) values
      ('10000000-0000-0000-0000-00000000000a', 'Test Office', '${OFFICE}', '{office}'),
      ('10000000-0000-0000-0000-00000000000b', 'Test Reviewer', '${REVIEWER}', '{management,reviewer}');
    insert into people (id, full_name, initials, roles) values
      ('10000000-0000-0000-0000-00000000000d', 'Test Technician', 'TT', '{technician}');
    insert into customers (id, name, code, gstin) values
      ('20000000-0000-0000-0000-000000000001', 'Test Customer Pvt Ltd', 'TCPL', '29AAAAA0000A1Z5');
  `);
}, 60_000);

describe("job numbers", () => {
  it("numbers jobs per financial year as BITA/YY-YY/0001", async () => {
    const a = await db.query<{ n: string }>("select next_job_no() as n");
    const b = await db.query<{ n: string }>("select next_job_no() as n");
    expect(a.rows[0].n).toMatch(/^BITA\/\d{2}-\d{2}\/\d{4}$/);
    expect(Number(b.rows[0].n.slice(-4))).toBe(Number(a.rows[0].n.slice(-4)) + 1);
  });
});

describe("row level security", () => {
  it("lets office staff create and read customers", async () => {
    await as(OFFICE, "insert into customers (name) values ('Office Added Ltd')");
    const r = await as<{ name: string }>(OFFICE, "select name from customers order by name");
    expect(r.rows.map((x) => x.name)).toContain("Office Added Ltd");
  });

  it("shows nothing to a logged-in user who is not BITA staff", async () => {
    const r = await as(OUTSIDER, "select * from customers");
    expect(r.rows).toHaveLength(0);
  });

  it("blocks a user who is not BITA staff from writing", async () => {
    await expect(as(OUTSIDER, "insert into customers (name) values ('Intruder')")).rejects.toThrow();
  });

  it("does not let office staff edit people or their roles", async () => {
    const r = await as(OFFICE, "update people set roles = '{management}' where user_id = $1 returning id", [OFFICE]);
    expect(r.rows).toHaveLength(0);
  });

  it("lets management change only the reminder pause flag on an invoice", async () => {
    await db.exec(`
      insert into jobs (id, customer_id) values ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001');
      insert into invoices (job_id, kind, zoho_id, total) values ('30000000-0000-0000-0000-000000000009', 'tax_invoice', 'Z-9', 1000);
    `);
    const ok = await as(REVIEWER, "update invoices set reminders_paused = true where zoho_id = 'Z-9' returning id");
    expect(ok.rows).toHaveLength(1);
    await expect(as(REVIEWER, "update invoices set total = 1 where zoho_id = 'Z-9'")).rejects.toThrow();
  });
});

describe("reports", () => {
  const JOB = "30000000-0000-0000-0000-000000000001";
  const INSP = "40000000-0000-0000-0000-000000000001";

  beforeAll(async () => {
    await db.exec(`
      insert into jobs (id, customer_id) values ('${JOB}', '20000000-0000-0000-0000-000000000001');
      insert into inspections (id, job_id, method, readings, submitted_at, missing_fields)
        values ('${INSP}', '${JOB}', 'UT', '{"couplant": "Oil"}', now(), '{sensitivity}');
    `);
  });

  it("cannot be prepared while mandatory readings are missing", async () => {
    await expect(
      db.query(`insert into reports (job_id, inspection_id, method, report_no) values ($1, $2, 'UT', 'T-001')`, [JOB, INSP]),
    ).rejects.toThrow(/Mandatory readings missing: sensitivity/);
  });

  it("can be approved only by a technical reviewer, and the PDF only after approval", async () => {
    await db.exec(`update inspections set missing_fields = '{}' where id = '${INSP}'`);
    await db.query(`insert into reports (job_id, inspection_id, method, report_no) values ($1, $2, 'UT', 'T-002')`, [JOB, INSP]);

    await expect(db.query("update reports set pdf_path = 'x.pdf' where report_no = 'T-002'")).rejects.toThrow();
    await expect(
      db.query(`update reports set status = 'approved', approved_at = now(),
                approved_by = '10000000-0000-0000-0000-00000000000a' where report_no = 'T-002'`),
    ).rejects.toThrow(/Only a technical reviewer/);

    await db.query(`update reports set status = 'approved', approved_at = now(),
                    approved_by = '10000000-0000-0000-0000-00000000000b', pdf_path = 'x.pdf' where report_no = 'T-002'`);
  });
});

describe("correction log", () => {
  it("keeps the original and corrected value, and who made the change", async () => {
    const job = "30000000-0000-0000-0000-000000000002";
    const insp = "40000000-0000-0000-0000-000000000002";
    await db.exec(`
      insert into jobs (id, customer_id) values ('${job}', '20000000-0000-0000-0000-000000000001');
      insert into inspections (id, job_id, method, observations) values ('${insp}', '${job}', 'MPT', 'No indications');
    `);
    await db.exec("select set_config('app.actor_person_id', '10000000-0000-0000-0000-00000000000d', false)");
    await db.query("update inspections set observations = 'Linear indication at weld toe' where id = $1", [insp]);
    await db.exec("select set_config('app.actor_person_id', '', false)");

    const r = await db.query<{ changed_fields: string[]; old_obs: string; new_obs: string; changed_by_person: string }>(
      `select changed_fields, old_row ->> 'observations' as old_obs, new_row ->> 'observations' as new_obs, changed_by_person
       from audit_log where record_id = $1 and action = 'update'`,
      [insp],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      changed_fields: ["observations"],
      old_obs: "No indications",
      new_obs: "Linear indication at weld toe",
      changed_by_person: "10000000-0000-0000-0000-00000000000d",
    });
  });
});

describe("invoices", () => {
  it("allows only one GST invoice per job", async () => {
    const job = "30000000-0000-0000-0000-000000000003";
    await db.exec(`insert into jobs (id, customer_id) values ('${job}', '20000000-0000-0000-0000-000000000001')`);
    await db.query(`insert into invoices (job_id, kind, zoho_id) values ($1, 'proforma', 'P-1')`, [job]);
    await db.query(`insert into invoices (job_id, kind, zoho_id) values ($1, 'tax_invoice', 'I-1')`, [job]);
    await expect(db.query(`insert into invoices (job_id, kind, zoho_id) values ($1, 'tax_invoice', 'I-2')`, [job])).rejects.toThrow();
  });
});

describe("quotations", () => {
  it("can be approved only by management", async () => {
    await expect(
      db.query(`insert into quotations (ref_no, customer_id, status, approved_at, approved_by)
                values ('T-Q1', '20000000-0000-0000-0000-000000000001', 'approved', now(), '10000000-0000-0000-0000-00000000000a')`),
    ).rejects.toThrow(/Only management/);
  });
});
