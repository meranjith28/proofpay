import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { signOut } from "./auth-actions";

export const metadata: Metadata = {
  title: "ProofPay — freelance payments that release themselves",
  description: "Clients fund jobs through PayPal. An AI agent checks the work against an agreed checklist and pays the freelancer when every item passes.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Public+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm text-white">$</span>
              ProofPay
            </a>
            <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-medium">
              {user?.role === "client" && <a href="/" className="hover:text-action">Your jobs</a>}
              {user?.role === "client" && <a href="/#post" className="hover:text-action">Post a job</a>}
              {user?.role === "freelancer" && <a href="/work" className="hover:text-action">Find work</a>}
              {user?.role === "freelancer" && <a href="/work#mine" className="hover:text-action">Your work</a>}
              <span className="hidden rounded-full border border-held/40 bg-held-soft px-3 py-1 text-xs font-medium text-held md:inline">
                PayPal sandbox: test money only
              </span>
              {user ? (
                <form action={signOut} className="flex items-center gap-3">
                  <span className="text-muted">
                    {user.name} <span className="rounded bg-paper px-1.5 py-0.5 text-xs">{user.role === "client" ? "Client" : "Freelancer"}</span>
                  </span>
                  <button className="underline underline-offset-4 hover:text-action">Sign out</button>
                </form>
              ) : (
                <a href="/login" className="rounded-md bg-ink px-3 py-1.5 text-white hover:bg-black">Sign in</a>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-muted">
          Built for the PayPal AI Hackathon. Payments run in the PayPal sandbox.
        </footer>
      </body>
    </html>
  );
}
