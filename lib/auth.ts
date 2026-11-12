import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { sql, migrate } from "./db";

export type Role = "client" | "freelancer";
export type User = { id: number; email: string; name: string; role: Role };

const COOKIE = "pp_session";
const secret = () =>
  process.env.SESSION_SECRET ||
  createHash("sha256").update(`proofpay-session:${process.env.PAYPAL_CLIENT_SECRET ?? "dev"}`).digest("hex");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function checkPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const test = scryptSync(password, salt, 32);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && timingSafeEqual(known, test);
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/** Start a session for this user (signed cookie, 7 days). */
export async function startSession(userId: number) {
  const value = `${userId}.${sign(String(userId))}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig || sign(id) !== sig) return null;
  await migrate();
  const [u] = await sql`select id, email, name, role from users where id = ${Number(id)}`;
  return (u as User) ?? null;
}

/** Require a signed-in user (optionally with a given role), or send them to sign in. */
export async function requireUser(role?: Role): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) {
    redirect(`/?error=${encodeURIComponent(role === "client" ? "Only clients can do that. Sign in with a client account." : "Only freelancers can do that. Sign in with a freelancer account.")}`);
  }
  return u;
}

export const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** What this user may do with this job. */
export function accessTo(
  job: { client_email: string; freelancer_email: string | null; status: string },
  user: User | null,
) {
  const isClient = !!user && user.role === "client" && same(job.client_email, user.email);
  const isFreelancer = !!user && user.role === "freelancer" && same(job.freelancer_email, user.email);
  const openForFreelancers = job.status === "funded" && !job.freelancer_email;
  const canView = isClient || isFreelancer || (user?.role === "freelancer" && openForFreelancers);
  return { isClient, isFreelancer, openForFreelancers, canView };
}

/** Demo accounts linked to the PayPal sandbox accounts, for judges and the video. */
export const DEMO = {
  client: { email: "sb-kszla53855379@personal.example.com", name: "Demo client" },
  freelancer: { email: "sb-20twj53855622@personal.example.com", name: "Demo freelancer" },
} as const;
