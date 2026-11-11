// Thin PayPal REST client for the calls the app makes directly.
// Sandbox by default; set PAYPAL_ENV=live only with real approval.

const BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials are not set");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function call<T>(path: string, init: { method?: string; body?: unknown; requestId?: string } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      // Idempotency key: PayPal returns the original result if the same id is retried.
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${path} failed: ${res.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

const usd = (amount: number) => ({ currency_code: "USD", value: amount.toFixed(2) });

/** Client funds a job. Returns the order id and the URL where the client approves payment. */
export async function createFundingOrder(jobId: string, title: string, amount: number) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const order = await call<{ id: string; links: { rel: string; href: string }[] }>("/v2/checkout/orders", {
    method: "POST",
    requestId: `fund-${jobId}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [{ reference_id: jobId, description: title.slice(0, 127), amount: usd(amount) }],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: `${appUrl}/api/jobs/${jobId}/funded`,
            cancel_url: `${appUrl}/jobs/${jobId}?funding=cancelled`,
            user_action: "PAY_NOW",
          },
        },
      },
    },
  });
  const approveUrl = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  return { orderId: order.id, approveUrl };
}

/** Capture an approved order. Returns the capture id needed for any later refund. */
export async function captureOrder(orderId: string) {
  const res = await call<{
    status: string;
    purchase_units: { payments: { captures: { id: string; status: string }[] } }[];
  }>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", requestId: `capture-${orderId}` });
  const capture = res.purchase_units[0]?.payments.captures[0];
  return { status: res.status, captureId: capture?.id };
}

/** Pay the freelancer after a passed verification. Guarded by a spend cap and an idempotency key. */
export async function payFreelancer(jobId: string, email: string, amount: number, note: string) {
  const cap = Number(process.env.MAX_PAYOUT_USD ?? 500);
  if (amount <= 0 || amount > cap) throw new Error(`Payout of $${amount} is outside the allowed range (max $${cap})`);
  const res = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
    method: "POST",
    body: {
      // sender_batch_id is PayPal's duplicate guard for payouts: one payout per job, ever.
      sender_batch_header: { sender_batch_id: `payout-${jobId}`, email_subject: "Your work was verified and paid" },
      items: [{ recipient_type: "EMAIL", receiver: email, amount: { currency: "USD", value: amount.toFixed(2) }, note: note.slice(0, 1000), sender_item_id: jobId }],
    },
  });
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

/** Return the client's money when a job is cancelled or fails. */
export async function refundClient(jobId: string, captureId: string) {
  const res = await call<{ id: string; status: string }>(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    requestId: `refund-${jobId}`,
    body: {},
  });
  return { refundId: res.id, status: res.status };
}
