import { createHmac, timingSafeEqual } from "crypto";
import { findOrder, activate } from "../../../ads-lib";
export const runtime = "nodejs";
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET; if (!secret) return new Response("not configured", { status: 503 });
  const raw = await req.text(); const sig = req.headers.get("stripe-signature") || "";
  const parts = Object.fromEntries(sig.split(",").map(p => p.split("=")).filter(p => p.length === 2 && p[0] === "t"));
  const t = parts.t; const v1s = sig.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
  const exp = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 600 || !v1s.some(v => v.length === exp.length && timingSafeEqual(Buffer.from(v), Buffer.from(exp)))) return new Response("bad signature", { status: 400 });
  const ev = JSON.parse(raw);
  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    const s = ev.data.object; const id = s.metadata?.order_id || s.client_reference_id;
    if (s.payment_status === "paid" && id) { const f = await findOrder(id); if (f && f.status === "approved") await activate(f.order, "approved", { paymentIntent: s.payment_intent, amountPaid: s.amount_total, livemode: s.livemode }); }
  }
  return Response.json({ received: true });
}
