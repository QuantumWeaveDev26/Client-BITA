import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

// Every login lands on its own home screen (management, office, reviewer, technician).
export default async function Home() {
  const { person } = await requireUser();
  redirect(person ? homeFor(person.roles) : "/dashboard");
}
