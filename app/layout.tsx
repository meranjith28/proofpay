import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { signOut } from "./auth-actions";
import { Logo } from "./icons";

export const metadata: Metadata = {
  title: "ProofPay — freelance payments that release themselves",
  description: "Clients fund jobs through PayPal. An AI agent checks the work against an agreed checklist and pays the freelancer when every item passes.",
};

const BUILT_WITH = ["PayPal Orders", "PayPal Payouts", "PayPal Agent Toolkit", "KERNEL", "Zapier", "AG Grid", "Render"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  const link = "rounded-lg px-3 py-2 text-muted transition-colors hover:bg-paper hover:text-ink";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <a href="/" className="flex items-center gap-2.5 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              <Logo />
              ProofPay
            </a>
            <nav className="flex flex-wrap items-center justify-end gap-x-1 gap-y-2 text-sm font-medium">
              {user?.role === "client" && <a href="/" className={link}>Your jobs</a>}
              {user?.role === "client" && <a href="/#post" className={link}>Post a job</a>}
              {user?.role === "freelancer" && <a href="/work" className={link}>Find work</a>}
              {user?.role === "freelancer" && <a href="/work#mine" className={link}>Your work</a>}
              {!user && <a href="/#how" className={`${link} hidden sm:inline`}>How it works</a>}
              <span className="mx-2 hidden items-center gap-1.5 rounded-full border border-held/30 bg-held-soft px-3 py-1 text-xs font-medium text-held lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-held" />
                PayPal sandbox: test money only
              </span>
              {user ? (
                <form action={signOut} className="flex items-center gap-2 border-l border-line pl-3">
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold uppercase text-white">
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="hidden leading-tight sm:block">
                    <span className="block max-w-[10rem] truncate text-ink">{user.name}</span>
                    <span className="block text-xs font-normal text-muted">{user.role === "client" ? "Client" : "Freelancer"}</span>
                  </span>
                  <button className="btn btn-ghost ml-1 px-3 py-1.5">Sign out</button>
                </form>
              ) : (
                <a href="/login" className="btn btn-dark px-3.5 py-2">Sign in</a>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Logo className="h-7 w-7" />
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">ProofPay</span> — built for the PayPal AI Hackathon. Payments run in the PayPal sandbox.
              </p>
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Built with">
              {BUILT_WITH.map((b) => (
                <li key={b} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-muted">{b}</li>
              ))}
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
