import site from "../../../../content/site.json";
import { PLANS, BASE, NOTIFY, findOrder, moveOrder, verify, send, esc, stripe, stripeReady, delPath } from "../../../ads-lib";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const page = (t, body, status = 200) => new Response(`<!doctype html><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${esc(t)}</title><body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px"><h1>${esc(t)}</h1>${body}</body>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
const ACTIONS = { approve: "Approve and send payment link", reject: "Reject this ad", remove: "Remove this ad now", purge: "Delete this record" };
async function load(q) {
  const id = String(q.get("id") || "").replace(/[^a-zA-Z0-9_-]/g, ""), action = q.get("action"), sig = q.get("sig");
  if (!ACTIONS[action] || !verify(id, action, sig)) return { err: page("Link not valid", "<p>This link is invalid or has been altered.</p>", 403) };
  const f = await findOrder(id); if (!f) return { err: page("Not found", "<p>No ad order with that ID.</p>", 404) };
  return { id, action, sig, ...f };
}
export async function GET(req) {
  const q = new URL(req.url).searchParams; const L = await load(q); if (L.err) return L.err; const o = L.order;
  const summary = `<p><b>${esc(o.business)}</b> · ${esc(PLANS[o.plan]?.name)} · start ${esc(o.startDate)} · current status: <b>${L.status}</b></p><blockquote><b>${esc(o.headline)}</b><br>${esc(o.body)}<br><small>${esc(o.url)}</small></blockquote>`;
  const reason = L.action === "reject" || L.action === "remove" ? `<p><label>Reason sent to the advertiser (optional)<br><textarea name="reason" rows="3" style="width:100%"></textarea></label></p>` : "";
  return page(ACTIONS[L.action], `${summary}<form method="post">${reason}<button style="font-size:1.1rem;padding:10px 18px">${ACTIONS[L.action]}</button></form>`);
}
export async function POST(req) {
  const q = new URL(req.url).searchParams; const L = await load(q); if (L.err) return L.err; const o = L.order;
  let reason = ""; try { reason = String((await req.formData()).get("reason") || "").slice(0, 1000); } catch {}
  const plan = PLANS[o.plan];
  if (L.action === "approve") {
    if (!["pending", "approved"].includes(L.status)) return page("Already handled", `<p>This order is ${L.status}.</p>`);
    if (!stripeReady()) { await moveOrder({ ...o, approvedAt: new Date().toISOString() }, L.status, "approved");
      return page("Approved, but online payment isn't set up", "<p>The order is marked approved. Stripe isn't configured on this site yet (STRIPE_SECRET_KEY), so no payment link was sent. Reply to the advertiser to arrange payment, or add the Stripe key and press Approve again.</p>"); }
    const s = await stripe("checkout/sessions", { mode: "payment", customer_email: o.email, client_reference_id: o.id, "metadata[order_id]": o.id, "metadata[site]": site.domain,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][unit_amount]": String(plan.price),
      "line_items[0][price_data][product_data][name]": `${site.name}: ${plan.name}, ${plan.days} days`,
      success_url: `${BASE}/advertise/thanks?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${BASE}/advertise`, expires_at: String(Math.floor(Date.now() / 1000) + 23 * 3600) });
    await moveOrder({ ...o, approvedAt: new Date().toISOString(), checkoutSession: s.id, checkoutUrl: s.url, livemode: s.livemode }, L.status, "approved");
    await send(o.email, `Your ad for ${site.name} is approved: payment link inside`, `<p>Hi ${esc(o.name)},</p><p>Good news: your ad for ${esc(o.business)} is approved. To schedule it, pay $${plan.price / 100} for ${esc(plan.name)} (${plan.days} days, starting ${esc(o.startDate)}):</p><p><a href="${s.url}">Pay securely with Stripe</a></p><p>This link expires in about 23 hours. If it expires, just reply and we'll send a new one.</p><p>— ${esc(site.name)}</p>`);
    return page("Approved", `<p>A Stripe payment link (${s.livemode ? "LIVE" : "test mode"}) was emailed to ${esc(o.email)}. The ad goes live on its start date once paid.</p>`);
  }
  if (L.action === "reject") {
    if (!["pending", "approved"].includes(L.status)) return page("Already handled", `<p>This order is ${L.status}.</p>`);
    await moveOrder({ ...o, rejectedAt: new Date().toISOString(), reason }, L.status, "rejected");
    await send(o.email, `About your ad order for ${site.name}`, `<p>Hi ${esc(o.name)},</p><p>Thanks for your interest in advertising on ${esc(site.name)}. We're not able to run this ad${reason ? `: ${esc(reason)}` : ", as it doesn't fit our Ad Policy"}. You haven't been charged.</p><p>— ${esc(site.name)}</p>`);
    return page("Rejected", `<p>The advertiser was told, and nothing was charged.</p>`);
  }
  if (L.action === "remove") {
    if (L.status !== "active") return page("Not active", `<p>This order is ${L.status}.</p>`);
    await moveOrder({ ...o, removedAt: new Date().toISOString(), reason }, "active", "expired");
    await send(NOTIFY, `Ad removed: ${o.business}`, `<p>The ad was removed. If unused time should be refunded, issue a prorated refund for payment ${esc(o.paymentIntent || o.checkoutSession || "")} in Stripe.</p>`);
    return page("Removed", "<p>The ad no longer shows. Per the Ad Policy, refund the unused time in Stripe (a reminder email was sent to you).</p>");
  }
  if (L.action === "purge") { await delPath(`ads/${L.status}/${o.id}.json`); if (o.image) await delPath(o.image.path); return page("Deleted", "<p>Record deleted.</p>"); }
}
