import { put } from "@vercel/blob";
import { createHash } from "crypto";
export const runtime = "nodejs";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid request." }, { status: 400 }); }
  if (body && body.website) return Response.json({ ok: true }); // honeypot
  const email = String((body && body.email) || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  const record = { email, source: String(body.source || "").slice(0, 200), createdAt: new Date().toISOString(), ua: (req.headers.get("user-agent") || "").slice(0, 200) };
  const saved = [];
  try {
    if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
      const r = await fetch(`https://api.resend.com/audiences/${process.env.RESEND_AUDIENCE_ID}/contacts`, {
        method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, unsubscribed: false }) });
      if (r.ok || r.status === 409) saved.push("resend"); else console.error("resend contact failed", r.status);
    }
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const id = createHash("sha256").update(email).digest("hex").slice(0, 32);
      await put(`signups/${id}.json`, JSON.stringify(record), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
      saved.push("blob");
    }
  } catch (e) { console.error("signup store error", e && e.message); }
  if (!saved.length) return Response.json({ ok: false, error: "Signup is temporarily unavailable. Please try again later." }, { status: 503 });
  return Response.json({ ok: true });
}
