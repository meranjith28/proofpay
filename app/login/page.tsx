import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signIn, signUp, demoSignIn } from "../auth-actions";
import { SubmitButton } from "../submit-button";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.role === "freelancer" ? "/work" : "/");
  const { mode, error } = await searchParams;
  const signup = mode === "signup";

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <section>
        <h1 className="text-3xl font-bold">{signup ? "Create your account" : "Sign in"}</h1>
        <p className="mt-2 text-muted">
          Clients post and fund jobs. Freelancers find funded work and get paid when it passes the checklist.
        </p>
        {error && <div role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">{error}</div>}

        {signup ? (
          <form action={signUp} className="mt-6 space-y-4 rounded-xl border border-line bg-white p-6">
            <fieldset>
              <legend className="text-sm font-medium">I want to</legend>
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
            <SubmitButton pending="Creating account…">Create account</SubmitButton>
            <p className="text-sm text-muted">Already have an account? <a className="text-action underline" href="/login">Sign in</a></p>
          </form>
        ) : (
          <form action={signIn} className="mt-6 space-y-4 rounded-xl border border-line bg-white p-6">
            <Field label="Email"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
            <Field label="Password"><input name="password" type="password" required className="input" autoComplete="current-password" /></Field>
            <SubmitButton pending="Signing in…">Sign in</SubmitButton>
            <p className="text-sm text-muted">New here? <a className="text-action underline" href="/login?mode=signup">Create an account</a></p>
          </form>
        )}
      </section>

      <section className="rounded-xl border-2 border-ink bg-white p-6 md:mt-16">
        <h2 className="text-xl font-bold">Just looking? Try a demo account</h2>
        <p className="mt-2 text-sm text-muted">
          These are linked to PayPal sandbox accounts, so funding and payouts work end to end with test money.
          Open the freelancer in a second browser or a private window to see both sides at once.
        </p>
        <div className="mt-5 space-y-3">
          <form action={demoSignIn.bind(null, "client")}>
            <SubmitButton pending="Signing in…">Continue as the demo client</SubmitButton>
          </form>
          <form action={demoSignIn.bind(null, "freelancer")}>
            <button className="rounded-md border border-ink bg-white px-4 py-2 text-sm font-semibold hover:bg-paper">Continue as the demo freelancer</button>
          </form>
        </div>
      </section>
    </div>
  );
}

function RoleOption({ value, title, text, defaultChecked }: { value: string; title: string; text: string; defaultChecked?: boolean }) {
  return (
    <label className="cursor-pointer rounded-lg border border-line p-3 has-[:checked]:border-ink has-[:checked]:bg-paper has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action">
      <input type="radio" name="role" value={value} defaultChecked={defaultChecked} className="sr-only" />
      <span className="block font-semibold">{title}</span>
      <span className="block text-xs text-muted">{text}</span>
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
