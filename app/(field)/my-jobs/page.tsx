import Link from "next/link";
import { Badge, Button, ButtonLink, Mono } from "@/components/ui";
import { requireTechnician } from "@/lib/auth";
import { longDateIST, shortDate, todayIST, weekday } from "@/lib/dates";
import { METHOD_LABEL } from "../../(office)/jobs/labels";
import { acknowledge } from "./actions";

export const metadata = { title: "Today's work – BITA" };

// Technician home: today's assignments as big cards, then what's coming (X1 inside the app).
export default async function MyJobs() {
  const { supabase, person } = await requireTechnician();
  const today = todayIST();

  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      "id, work_date, acknowledged_at, completed_at, notes, jobs(id, job_no, site, scope, test_methods, customers(name)), assignment_equipment(equipment(model, serial_no, calibration_due))",
    )
    .eq("person_id", person.id)
    .gte("work_date", today)
    .order("work_date");

  const todays = (assignments ?? []).filter((a) => a.work_date === today);
  const later = (assignments ?? []).filter((a) => a.work_date > today);

  return (
    <>
      <p className="text-[13px] text-ink-3">{longDateIST()}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">Today&apos;s work</h1>
      <p className="mb-5 mt-0.5 text-ink-2">
        {todays.length === 0 ? "Nothing assigned today" : `${todays.length} ${todays.length === 1 ? "job" : "jobs"}`}
        {later.length > 0 && ` · ${later.length} coming up`}
      </p>

      <div className="space-y-3">
        {todays.map((a) => (
          <article key={a.id} className="rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between">
              <span className="text-ink-3">
                <Mono>{a.jobs?.job_no}</Mono>
              </span>
              <div className="flex gap-1.5">
                {a.jobs?.test_methods.map((m) => (
                  <Badge key={m}>{METHOD_LABEL[m]}</Badge>
                ))}
              </div>
            </div>
            <h2 className="mt-2.5 text-base font-semibold">{a.jobs?.customers?.name}</h2>
            <p className="text-[13.5px] text-ink-2">{[a.jobs?.site, a.jobs?.scope].filter(Boolean).join(" · ")}</p>
            {a.assignment_equipment.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-[12.5px] text-ink-3">
                {a.assignment_equipment.map((e, i) => (
                  <li key={i}>
                    {e.equipment?.model} · {e.equipment?.serial_no}
                    {e.equipment?.calibration_due && ` · calibration due ${shortDate(e.equipment.calibration_due)}`}
                  </li>
                ))}
              </ul>
            )}
            {a.notes && <p className="mt-3 rounded-lg bg-side px-3 py-2 text-[13px] text-ink-2">{a.notes}</p>}
            <div className="mt-4 grid gap-2">
              {!a.acknowledged_at && (
                <form action={acknowledge.bind(null, a.id)}>
                  <Button className="w-full py-3 text-[15px]">I&apos;ve seen this job</Button>
                </form>
              )}
              <ButtonLink href={`/my-jobs/${a.id}`} variant={a.acknowledged_at ? "primary" : "secondary"}>
                {a.completed_at ? "Readings submitted" : "Enter readings"}
              </ButtonLink>
            </div>
          </article>
        ))}

        {later.map((a) => (
          <Link key={a.id} href={`/my-jobs/${a.id}`} className="block rounded-2xl border border-line p-4 opacity-80 hover:opacity-100">
            <div className="flex items-center justify-between text-[13px] text-ink-3">
              <span>
                {weekday(a.work_date)} {shortDate(a.work_date)}
              </span>
              <span>{a.jobs?.test_methods.map((m) => METHOD_LABEL[m]).join(", ")}</span>
            </div>
            <h2 className="mt-1.5 text-[15px] font-semibold">{a.jobs?.customers?.name}</h2>
            <p className="text-[13px] text-ink-2">{a.jobs?.site ?? a.jobs?.scope}</p>
          </Link>
        ))}
      </div>

      <Link
        href="/my-jobs/report-issue"
        className="mt-5 flex justify-center rounded-xl border border-dashed border-line px-4 py-3 text-[14px] text-ink-2 hover:border-ink hover:text-ink"
      >
        Report a delay, leave or problem
      </Link>
    </>
  );
}
