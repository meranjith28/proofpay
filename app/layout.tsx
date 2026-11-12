import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPay — freelance payments that release themselves",
  description: "Clients fund jobs through PayPal. An AI agent checks the work against an agreed checklist and pays the freelancer when every item passes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <span className="rounded-full border border-held/40 bg-held-soft px-3 py-1 text-xs font-medium text-held">
              PayPal sandbox: test money only
            </span>
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
