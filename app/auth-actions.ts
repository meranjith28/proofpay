"use server";
import { redirect } from "next/navigation";
import { sql, migrate } from "@/lib/db";
import { hashPassword, checkPassword, startSession, endSession, DEMO, type Role } from "@/lib/auth";

const back = (msg: string, mode = "signin") => redirect(`/login?mode=${mode}&error=${encodeURIComponent(msg)}`);
const home = (role: string) => (role === "freelancer" ? "/work" : "/");

export async function signUp(form: FormData) {
  await migrate();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "") as Role;
  if (!name || !email || !["client", "freelancer"].includes(role)) back("Fill in your name, email and role.", "signup");
  if (password.length < 6) back("Use a password of at least 6 characters.", "signup");
  const [exists] = await sql`select id from users where lower(email) = ${email}`;
  if (exists) back("An account with this email already exists. Sign in instead.", "signin");
  const [u] = await sql`insert into users (email, name, role, password_hash) values (${email}, ${name}, ${role}, ${hashPassword(password)}) returning id`;
  await startSession(u.id);
  redirect(home(role));
}

export async function signIn(form: FormData) {
  await migrate();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [u] = await sql`select id, role, password_hash from users where lower(email) = ${email}`;
  if (!u || !checkPassword(password, u.password_hash)) back("That email and password don't match an account.");
  await startSession(u.id);
  redirect(home(u.role));
}

/** One-click demo accounts, linked to the PayPal sandbox client and freelancer. */
export async function demoSignIn(role: Role) {
  await migrate();
  const d = DEMO[role];
  const [u] = await sql`
    insert into users (email, name, role) values (${d.email}, ${d.name}, ${role})
    on conflict (email) do update set role = excluded.role
    returning id`;
  await startSession(u.id);
  redirect(home(role));
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
