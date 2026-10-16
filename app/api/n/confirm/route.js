import { findOrder, activate, stripe, stripeReady } from "../../../ads-lib";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req) {
  const sid = String(new URL(req.url).searchParams.get("session_id") || "").replace(/[^a-zA-Z0-9_]/g, "");
  if (!sid || !stripeReady()) return Response.json({ ok: false });
  try {
    const s = await stripe(`checkout/sessions/${sid}`, null, "GET");
    if (s.payment_status !== "paid") return Response.json({ ok: false, pending: true });
    const f = await findOrder(s.metadata?.order_id || s.client_reference_id || "");
    if (!f) return Response.json({ ok: false });
    if (f.status === "approved" && f.order.checkoutSession === s.id) { const o = await activate(f.order, "approved", { paymentIntent: s.payment_intent, amountPaid: s.amount_total, livemode: s.livemode }); return Response.json({ ok: true, startsAt: o.startsAt, expiresAt: o.expiresAt }); }
    if (f.status === "active") return Response.json({ ok: true, startsAt: f.order.startsAt, expiresAt: f.order.expiresAt });
    return Response.json({ ok: false });
  } catch (e) { console.error("confirm", e?.message); return Response.json({ ok: false }); }
}
