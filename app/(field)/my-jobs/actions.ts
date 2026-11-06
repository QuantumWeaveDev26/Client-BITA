"use server";

import { revalidatePath } from "next/cache";
import { requireTechnician } from "@/lib/auth";

// A technician confirms they have seen today's assignment (X1). The database lets them change only this.
export async function acknowledge(assignmentId: string) {
  const { supabase } = await requireTechnician();
  await supabase.from("assignments").update({ acknowledged_at: new Date().toISOString() }).eq("id", assignmentId).is("acknowledged_at", null);
  revalidatePath("/my-jobs");
}
