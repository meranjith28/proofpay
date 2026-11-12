import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { getOrder } from "./paypal";

/**
 * PayPal Agent Toolkit, used by the settlement agent to check PayPal directly
 * (order status before paying out) and to issue refunds.
 * The toolkit returns JSON text; errors come back as { error: {...} }.
 */
let toolkit: PayPalAgentToolkit | null = null;

function getToolkit() {
  if (!toolkit) {
    toolkit = new PayPalAgentToolkit({
      clientId: process.env.PAYPAL_CLIENT_ID ?? "",
      clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
      configuration: {
        actions: { orders: { get: true }, payments: { createRefund: true, getRefunds: true } },
        context: { sandbox: process.env.PAYPAL_ENV !== "live" },
      },
    });
  }
  return toolkit;
}

type ToolkitTool = { execute: (args: Record<string, unknown>) => Promise<string> };

async function runTool(name: string, args: Record<string, unknown>) {
  const tool = getToolkit().getTools()[name] as unknown as ToolkitTool | undefined;
  if (!tool) throw new Error(`PayPal toolkit tool ${name} is not enabled`);
  const raw = await tool.execute(args);
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (data?.error) throw new Error(`PayPal toolkit ${name}: ${data.error.message ?? JSON.stringify(data.error)}`);
  return data;
}

/** Ask PayPal for the order and summarise whether the client's money really was captured. */
export async function checkFunding(orderId: string, expectedAmount: number) {
  let order;
  let via = "PayPal Agent Toolkit";
  try {
    order = await runTool("get_order", { id: orderId });
  } catch (e) {
    console.error("[paypal] toolkit get_order failed, using REST", e);
    order = await getOrder(orderId);
    via = "PayPal Orders API";
  }
  const unit = order?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const captured = Number(capture?.amount?.value ?? unit?.amount?.value ?? 0);
  const ok = order?.status === "COMPLETED" && capture?.status === "COMPLETED" && captured >= expectedAmount;
  return {
    ok,
    order_status: order?.status ?? "UNKNOWN",
    capture_status: capture?.status ?? "NONE",
    captured_amount: captured,
    capture_id: capture?.id ?? null,
    checked_via: via,
  };
}

/** Refund a captured payment through the toolkit. */
export async function toolkitRefund(captureId: string, note: string) {
  const refund = await runTool("create_refund", { capture_id: captureId, note_to_payer: note.slice(0, 255) });
  return { refundId: refund?.id as string, status: refund?.status as string };
}
