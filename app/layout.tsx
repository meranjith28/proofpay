import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPay — get paid when the work is proven",
  description: "AI-verified freelance escrow on PayPal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="text-xl font-semibold tracking-tight">
              Proof<span className="text-blue-600">Pay</span>
            </a>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">PayPal sandbox</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
