import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { resolveMx } from "dns/promises";
export const runtime = "nodejs";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const NOTIFY = Buffer.from("dmluY2VudEBzdG9yZW50ZWNoLmNvbQ==", "base64").toString("utf8");
const FROM = "Agents for Main Street <requests@agentsformainstreet.com>";
const SOURCE = "afms";
const SUBJECT_PREFIX = "[Agents for Main Street]";
const DISPOSABLE = new Set(["mailinator.com","guerrillamail.com","guerrillamail.net","sharklasers.com","10minutemail.com","10minutemail.net","tempmail.com","temp-mail.org","temp-mail.io","yopmail.com","yopmail.net","trashmail.com","getnada.com","nada.email","dispostable.com","maildrop.cc","throwawaymail.com","fakeinbox.com","mailnesia.com","mintemail.com","emailondeck.com","mohmal.com","tempail.com","tempr.email","discard.email","spamgourmet.com","getairmail.com","moakt.com","burnermail.io","mailpoof.com","inboxkitten.com","1secmail.com","tempmailo.com","minuteinbox.com","mail.tm","emailfake.com","grr.la","guerrillamailblock.com","spam4.me","mytemp.email"]);
const MIN_FILL_MS = 3000;
async function domainReceivesMail(domain) {
  try { const mx = await Promise.race([resolveMx(domain), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 4000))]); return Array.isArray(mx) && mx.some(m => m.exchange && m.exchange !== "."); }
  catch (e) { return e && e.message === "timeout" ? true : false; } // fail open on slow DNS
}
async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured yet
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: String(token) }); if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const j = await r.json(); return j.success === true;
  } catch { return false; }
}
const clean = (v, n) => String(v || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, n);
const cleanMultiline = (v, n) => String(v || "").replace(/[\r\t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
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
  const elapsed = Number(b.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return Response.json({ ok: false, error: "That was fast! Please take a moment to check your details and submit again." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!(await turnstileOk(b.turnstile, ip))) return Response.json({ ok: false, error: "Please complete the verification check and try again." }, { status: 400 });
  const rec = { name: clean(b.name, 120), email: clean(b.email, 254).toLowerCase(), message: cleanMultiline(b.message, 5000), consent: b.consent === true, source: SOURCE };
  if (!rec.name) return Response.json({ ok: false, error: "Please fill in your name." }, { status: 400 });
  if (!rec.message) return Response.json({ ok: false, error: "Please enter a message." }, { status: 400 });
  if (!EMAIL.test(rec.email)) return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  const dom = rec.email.split("@")[1];
  if (DISPOSABLE.has(dom)) return Response.json({ ok: false, error: "Please use a permanent email address, not a temporary one." }, { status: 400 });
  if (!(await domainReceivesMail(dom))) return Response.json({ ok: false, error: "That email domain doesn't seem to accept mail. Please check the address." }, { status: 400 });
  if (!rec.consent) return Response.json({ ok: false, error: "Please check the box agreeing to be contacted." }, { status: 400 });
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const record = { id, ...rec, createdAt: new Date().toISOString(), ua: clean(req.headers.get("user-agent"), 200) };
  let stored = false;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put(`contact-requests/${id}.json`, JSON.stringify(record), { access: "private", contentType: "application/json", addRandomSuffix: false });
      stored = true;
    }
  } catch (e) { console.error("contact request store error", e && e.message); }
  let notified = false;
  if (process.env.RESEND_API_KEY) {
    const rows = [["Name", rec.name], ["Email", rec.email], ["Message", rec.message], ["Source", rec.source], ["ID", id]]
      .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
    try {
      notified = await send(NOTIFY, `${SUBJECT_PREFIX} Contact form: ${rec.name}`, `<p>New contact form submission on agentsformainstreet.com:</p><table cellpadding="4">${rows}</table>`, rec.email);
      if (stored || notified) await send(rec.email, "We got your message", `<p>Hi ${esc(rec.name)},</p><p>Thanks for contacting Agents for Main Street. We'll review your message and follow up, usually within 2 business days.</p><p>— Agents for Main Street</p>`);
    } catch (e) { console.error("resend error", e && e.message); }
  }
  if (!stored && !notified) return Response.json({ ok: false, error: "Messages are temporarily unavailable. Please try again later." }, { status: 503 });
  return Response.json({ ok: true });
}
