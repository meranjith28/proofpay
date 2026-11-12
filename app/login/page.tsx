import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signIn, signUp, demoSignIn } from "../auth-actions";
import { SubmitButton } from "../submit-button";
import { IconBriefcase, IconCheck, IconWallet } from "../icons";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.role === "freelancer" ? "/work" : "/");
  const { mode, error } = await searchParams;
  const signup = mode === "signup";

  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
      <section className="card p-6 md:p-8">
        <h1 className="text-3xl font-bold">{signup ? "Create your account" : "Sign in"}</h1>
        <p className="mt-2 text-muted">
          Clients post and fund jobs. Freelancers find funded work and get paid when it passes the checklist.
        </p>
        {error && <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm">{error}</div>}

        {signup ? (
          <form action={signUp} className="mt-6 space-y-4">
            <fieldset>
              <legend className="text-sm font-semibold">I want to</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <RoleOption value="client" title="Hire" text="Post and fund jobs" defaultChecked />
                <RoleOption value="freelancer" title="Work" text="Deliver and get paid" />
              </div>
            </fieldset>
            <Field label="Your name"><input name="name" required className="input" autoComplete="name" /></Field>
            <Field label="PayPal email (payouts go here)">
              <input name="email" type="email" required className="input" autoComplete="email" placeholder="sb-…@personal.example.com in the sandbox" />
            </Field>
            <Field label="Password (6+ characters)"><input name="password" type="password" required minLength={6} className="input" autoComplete="new-password" /></Field>
            <SubmitButton full pending="Creating account…">Create account</SubmitButton>
            <p className="text-sm text-muted">Already have an account? <a className="font-semibold text-action underline underline-offset-4" href="/login">Sign in</a></p>
          </form>
        ) : (
          <form action={signIn} className="mt-6 space-y-4">
            <Field label="Email"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
            <Field label="Password"><input name="password" type="password" required className="input" autoComplete="current-password" /></Field>
            <SubmitButton full pending="Signing in…">Sign in</SubmitButton>
            <p className="text-sm text-muted">New here? <a className="font-semibold text-action underline underline-offset-4" href="/login?mode=signup">Create an account</a></p>
          </form>
        )}
      </section>

      <section className="hero-grid flex flex-col rounded-2xl p-6 text-white shadow-lift md:p-8">
        <h2 className="text-2xl font-bold">Just looking? Try a demo account</h2>
        <p className="mt-2 text-sm text-white/75">
          Both are linked to PayPal sandbox accounts, so funding and payouts work end to end with test money.
        </p>
        <div className="mt-6 space-y-3">
          <form action={demoSignIn.bind(null, "client")}>
            <DemoButton icon={<IconBriefcase />} title="Continue as the demo client" text="Post a job, fund it with PayPal, watch it get verified" />
          </form>
          <form action={demoSignIn.bind(null, "freelancer")}>
            <DemoButton icon={<IconWallet />} title="Continue as the demo freelancer" text="Accept a funded job, deliver, get paid on proof" />
          </form>
        </div>
        <ul className="mt-auto space-y-2 pt-8 text-sm text-white/75">
          {["Open the freelancer in a private window to see both sides at once", "No real money moves: everything runs in the PayPal sandbox"].map((t) => (
            <li key={t} className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DemoButton({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <button className="flex w-full items-center gap-3.5 rounded-xl border border-white/15 bg-white/[0.07] p-4 text-left transition-colors hover:border-white/40 hover:bg-white/[0.14]">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-navy">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-white/65">{text}</span>
      </span>
    </button>
  );
}
function RoleOption({ value, title, text, defaultChecked }: { value: string; title: string; text: string; defaultChecked?: boolean }) {
  return (
    <label className="cursor-pointer rounded-xl border border-line p-3.5 transition-colors has-[:checked]:border-action has-[:checked]:bg-action-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action">
      <input type="radio" name="role" value={value} defaultChecked={defaultChecked} className="sr-only" />
      <span className="block font-semibold">{title}</span>
      <span className="block text-xs text-muted">{text}</span>
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-semibold">{label}</span>{children}</label>;
}
