import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
export const runtime = "nodejs";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const NOTIFY = "vincent@storentech.com";
const FROM = "Agents for Main Street <requests@agentsformainstreet.com>";
const BUDGETS = ["Under $500", "$500–$1,500", "$1,500–$5,000", "$5,000+", "Not sure yet"];
const clean = (v, n) => String(v || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, n);
const esc = (s) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
async function send(to, subject, html, replyTo) {
  const r = await fetch("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }) });
  if (!r.ok) console.error("resend email failed", r.status, await r.text().catch(() => ""));
  return r.ok;
}
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (!b || typeof b !== "object") return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  if (b.website) return Response.json({ ok: true }); // honeypot
  const rec = { name: clean(b.name, 120), business: clean(b.business, 160), industry: clean(b.industry, 120),
    recipe: clean(b.recipe, 1000), budget: clean(b.budget, 40), email: clean(b.email, 254).toLowerCase(), consent: b.consent === true };
  if (!rec.name || !rec.business || !rec.industry) return Response.json({ ok: false, error: "Please fill in your name, business name and industry." }, { status: 400 });
  if (!BUDGETS.includes(rec.budget)) return Response.json({ ok: false, error: "Please choose a budget range." }, { status: 400 });
  if (!EMAIL.test(rec.email)) return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  if (!rec.consent) return Response.json({ ok: false, error: "Please check the box agreeing to be contacted." }, { status: 400 });
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const record = { id, ...rec, source: clean(b.source, 200), createdAt: new Date().toISOString(), ua: clean(req.headers.get("user-agent"), 200) };
  let stored = false;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put(`build-requests/${id}.json`, JSON.stringify(record), { access: "private", contentType: "application/json", addRandomSuffix: false });
      stored = true;
    }
  } catch (e) { console.error("build request store error", e && e.message); }
  let notified = false;
  if (process.env.RESEND_API_KEY) {
    const rows = [["Name", rec.name], ["Business", rec.business], ["Industry", rec.industry], ["Recipe", rec.recipe || "—"], ["Budget", rec.budget], ["Email", rec.email], ["ID", id]]
      .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("");
    try {
      notified = await send(NOTIFY, `New build request: ${rec.business}`, `<p>New "Request a build" submission on agentsformainstreet.com:</p><table cellpadding="4">${rows}</table>`, rec.email);
      if (stored || notified) await send(rec.email, "We got your build request", `<p>Hi ${esc(rec.name)},</p><p>Thanks for your request for ${esc(rec.business)}. StorenTech AI will review it and follow up with a quote, usually within 2 business days.</p><p>— Agents for Main Street</p>`);
    } catch (e) { console.error("resend error", e && e.message); }
  }
  if (!stored && !notified) return Response.json({ ok: false, error: "Requests are temporarily unavailable. Please try again later." }, { status: 503 });
  return Response.json({ ok: true });
}
