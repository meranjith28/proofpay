import { NextRequest, NextResponse } from "next/server";
import { sql, logEvent } from "@/lib/db";
import { captureOrder } from "@/lib/paypal";

// PayPal sends the client back here after they approve the payment.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job?.paypal_order_id) return NextResponse.redirect(`${appUrl}/jobs/${id}?funding=error`);
  if (job.paypal_capture_id) return NextResponse.redirect(`${appUrl}/jobs/${id}`);
  try {
    const { status, captureId } = await captureOrder(job.paypal_order_id);
    if (status !== "COMPLETED" || !captureId) throw new Error(`Capture status ${status}`);
    await sql`update jobs set status = 'funded', paypal_capture_id = ${captureId}, updated_at = now() where id = ${id}`;
    await logEvent(id, "paypal", "payment_captured", { captureId });
    return NextResponse.redirect(`${appUrl}/jobs/${id}?funding=ok`);
  } catch (e) {
    await logEvent(id, "paypal", "capture_failed", { error: String(e) });
    return NextResponse.redirect(`${appUrl}/jobs/${id}?funding=error`);
  }
}
