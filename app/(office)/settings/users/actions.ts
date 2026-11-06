"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Constants, type Database, type Enums } from "@/lib/db/types";
import { checked, friendlyError, text } from "@/lib/forms";

async function requireManagement() {
  const ctx = await requireStaff();
  if (!ctx.person || !ctx.person.roles.includes("management")) {
    redirect("/dashboard?error=" + encodeURIComponent("Only management can manage users and roles."));
  }
  return { ...ctx, person: ctx.person };
}

function parseRoles(fd: FormData): Enums<"app_role">[] {
  return fd
    .getAll("roles")
    .map(String)
    .filter((r): r is Enums<"app_role"> =>
      (Constants.public.Enums.app_role as readonly string[]).includes(r),
    );
}

function userFormError(msg: string): string {
  if (msg.includes("people_initials_key")) {
    return "Another person already uses these initials.";
  }
  if (msg.includes("people_user_id_key")) {
    return "That login is already linked to another person.";
  }
  return friendlyError(msg);
}

// Uses SUPABASE_SERVICE_ROLE_KEY on the server when configured to create or look up an auth.users login by email.
async function ensureAuthUserForEmail(
  email: string,
  password: string | null,
): Promise<{ userId: string | null; note?: string; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      userId: null,
      note: "Email saved on person record. Set SUPABASE_SERVICE_ROLE_KEY on the server to provision auth.users logins automatically.",
    };
  }

  const admin = createSupabaseAdmin<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) {
    return { userId: null, error: listError.message };
  }

  const normalized = email.toLowerCase();
  const existingUser = listData.users.find((u) => u.email?.toLowerCase() === normalized);
  if (existingUser) {
    if (password && password.length >= 6) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      });
      if (pwErr) return { userId: null, error: pwErr.message };
    }
    return { userId: existingUser.id };
  }

  if (password && password.length >= 6) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      return { userId: null, error: createErr?.message ?? "Could not create login." };
    }
    return { userId: created.user.id };
  }

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteErr || !invited.user) {
    return { userId: null, error: inviteErr?.message ?? "Could not invite user by email." };
  }
  return { userId: invited.user.id };
}

export async function createPerson(fd: FormData) {
  const { supabase } = await requireManagement();
  const full_name = text(fd, "full_name");
  if (!full_name) {
    redirect("/settings/users?error=" + encodeURIComponent("Full name is required."));
  }

  const initials = text(fd, "initials")?.toUpperCase() ?? null;
  const position = text(fd, "position");
  const mobile = text(fd, "mobile");
  const email = text(fd, "email")?.toLowerCase() ?? null;
  const password = text(fd, "password");
  const provisionLogin = checked(fd, "provision_login");
  const roles = parseRoles(fd);

  let user_id = text(fd, "user_id");
  let loginNote: string | undefined;

  if (!user_id && email && (provisionLogin || password)) {
    const res = await ensureAuthUserForEmail(email, password);
    if (res.error) {
      redirect("/settings/users?error=" + encodeURIComponent(res.error));
    }
    user_id = res.userId;
    loginNote = res.note;
  }

  const { error } = await supabase.from("people").insert({
    full_name,
    initials,
    position,
    mobile,
    email,
    roles,
    user_id: user_id || null,
    active: true,
  });

  if (error) {
    redirect("/settings/users?error=" + encodeURIComponent(userFormError(error.message)));
  }

  revalidatePath("/settings/users");
  revalidatePath("/registers");
  redirect(
    "/settings/users?saved=1" + (loginNote ? "&note=" + encodeURIComponent(loginNote) : ""),
  );
}

export async function updatePerson(personId: string, fd: FormData) {
  const { supabase } = await requireManagement();
  const full_name = text(fd, "full_name");
  if (!full_name) {
    redirect("/settings/users?error=" + encodeURIComponent("Full name is required."));
  }

  const initials = text(fd, "initials")?.toUpperCase() ?? null;
  const position = text(fd, "position");
  const mobile = text(fd, "mobile");
  const email = text(fd, "email")?.toLowerCase() ?? null;
  const password = text(fd, "password");
  const provisionLogin = checked(fd, "provision_login");
  const active = checked(fd, "active");
  const roles = parseRoles(fd);
  const manualUserId = text(fd, "user_id");

  const { data: current } = await supabase
    .from("people")
    .select("user_id")
    .eq("id", personId)
    .maybeSingle();

  let user_id: string | null | undefined = manualUserId !== null ? manualUserId : current?.user_id;
  let loginNote: string | undefined;

  if (email && (provisionLogin || password)) {
    const res = await ensureAuthUserForEmail(email, password);
    if (res.error) {
      redirect("/settings/users?error=" + encodeURIComponent(res.error));
    }
    if (res.userId) user_id = res.userId;
    loginNote = res.note;
  }

  const { error } = await supabase
    .from("people")
    .update({
      full_name,
      initials,
      position,
      mobile,
      email,
      roles,
      active,
      ...(user_id !== undefined ? { user_id } : {}),
    })
    .eq("id", personId);

  if (error) {
    redirect("/settings/users?error=" + encodeURIComponent(userFormError(error.message)));
  }

  revalidatePath("/settings/users");
  revalidatePath("/registers");
  redirect(
    "/settings/users?saved=1" + (loginNote ? "&note=" + encodeURIComponent(loginNote) : ""),
  );
}

export async function unlinkPersonLogin(personId: string) {
  const { supabase, person } = await requireManagement();
  if (person.id === personId) {
    redirect(
      "/settings/users?error=" + encodeURIComponent("You cannot unlink your own active management login."),
    );
  }

  const { error } = await supabase.from("people").update({ user_id: null }).eq("id", personId);
  if (error) {
    redirect("/settings/users?error=" + encodeURIComponent(userFormError(error.message)));
  }

  revalidatePath("/settings/users");
  redirect("/settings/users?saved=1");
}
