import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { resolveMx } from "dns/promises";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import site from "../../../../content/site.json";
import { PLANS, CATEGORIES, NOTIFY, BASE, putJson, send, esc, clean, adminLink, blobReady } from "../../../ads-lib";
export const runtime = "nodejs";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const DISPOSABLE = new Set(["mailinator.com","guerrillamail.com","guerrillamail.net","sharklasers.com","10minutemail.com","10minutemail.net","tempmail.com","temp-mail.org","temp-mail.io","yopmail.com","yopmail.net","trashmail.com","getnada.com","nada.email","dispostable.com","maildrop.cc","throwawaymail.com","fakeinbox.com","mailnesia.com","mintemail.com","emailondeck.com","mohmal.com","tempail.com","tempr.email","discard.email","spamgourmet.com","getairmail.com","moakt.com","burnermail.io","mailpoof.com","inboxkitten.com","1secmail.com","tempmailo.com","minuteinbox.com","mail.tm","emailfake.com","grr.la","guerrillamailblock.com","spam4.me","mytemp.email"]);
const MAX_IMG = 1024 * 1024;
const bad = (error, status = 400) => Response.json({ ok: false, error }, { status });
async function mxOk(d) { try { const mx = await Promise.race([resolveMx(d), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 4000))]); return mx.some(m => m.exchange && m.exchange !== "."); } catch (e) { return e?.message === "timeout"; } }
async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY; if (!secret) return true; if (!token) return false;
  try { const body = new URLSearchParams({ secret, response: String(token) }); if (ip) body.set("remoteip", ip);
    const j = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body })).json(); return j.success === true; } catch { return false; }
}
function imgInfo(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: "image/png", ext: "png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2; while (i < buf.length - 9) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: "image/jpeg", ext: "jpg", h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + len; }
    return { type: "image/jpeg", ext: "jpg", w: 0, h: 0 };
  }
  return null;
}
export async function POST(req) {
  let f; try { f = await req.formData(); } catch { return bad("Invalid request."); }
  const g = (k) => f.get(k);
  if (g("website_hp")) return Response.json({ ok: true });
  const elapsed = Number(g("elapsed")); if (!Number.isFinite(elapsed) || elapsed < 5000) return bad("That was fast! Please check your details and submit again.");
  if (!(await turnstileOk(g("turnstile"), (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()))) return bad("Please complete the verification check and try again.");
  if (!blobReady()) return bad("Ad orders are temporarily unavailable. Please try again later.", 503);
  const o = { name: clean(g("name"), 120), business: clean(g("business"), 160), site: clean(g("bizsite"), 300), email: clean(g("email"), 254).toLowerCase(), phone: "",
    category: clean(g("category"), 60), plan: clean(g("plan"), 20), startDate: clean(g("start"), 10), headline: clean(g("headline"), 200), body: clean(g("body"), 400), url: clean(g("url"), 500), notes: clean(g("notes"), 1000) };
  if (!o.name || !o.business) return bad("Please enter your name and business name.");
  for (const k of ["site", "url"]) { try { const u = new URL(o[k]); if (!/^https?:$/.test(u.protocol)) throw 0; o[k] = u.toString(); } catch { return bad(k === "url" ? "Please enter a full destination URL starting with https://" : "Please enter your business website starting with https://"); } }
  if (!EMAIL.test(o.email)) return bad("Please enter a valid email address.");
  const dom = o.email.split("@")[1]; if (DISPOSABLE.has(dom)) return bad("Please use a permanent email address.");
  if (!(await mxOk(dom))) return bad("That email domain doesn't seem to accept mail. Please check the address.");
  const ph = parsePhoneNumberFromString(clean(g("phone"), 40), "US"); if (!ph || !ph.isValid()) return bad("Please enter a valid phone number."); o.phone = ph.number;
  if (!CATEGORIES.includes(o.category)) return bad("Please choose a business category.");
  if (!PLANS[o.plan]) return bad("Please choose a placement.");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate) || o.startDate < today) return bad("Please choose a start date of today or later.");
  if (!o.headline || o.headline.length > 40) return bad("Headline is required and must be 40 characters or fewer.");
  if (!o.body || o.body.length > 120) return bad("Ad text is required and must be 120 characters or fewer.");
  if (g("agree") !== "on") return bad("Please confirm you agree to the Ad Policy.");
  const id = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
  const file = g("image");
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > MAX_IMG) return bad("Image must be 1 MB or smaller.");
    const buf = Buffer.from(await file.arrayBuffer()); const info = imgInfo(buf);
    if (!info) return bad("Image must be a PNG or JPG file.");
    if (info.w && (info.w > 2400 || info.h > 2400 || info.w < 100 || info.h < 50)) return bad("Image size should be about 600×314 px (or a 300×300 logo).");
    const path = `ads/images/${id}.${info.ext}`;
    await put(path, buf, { access: "private", contentType: info.type, addRandomSuffix: false });
    o.image = { path, type: info.type, w: info.w, h: info.h, bytes: file.size };
  }
  const order = { id, site: site.domain, ...o, bizsite: o.site, status: "pending", createdAt: new Date().toISOString(), ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(), ua: clean(req.headers.get("user-agent"), 200) };
  delete order.site; order.siteDomain = site.domain;
  await putJson(`ads/pending/${id}.json`, order);
  const plan = PLANS[o.plan];
  const rows = [["Site", site.domain], ["Order ID", id], ["Name", o.name], ["Business", o.business], ["Business website", o.site], ["Email", o.email], ["Phone", o.phone], ["Category", o.category],
    ["Placement", `${plan.name}: $${plan.price / 100} for ${plan.days} days`], ["Start date", o.startDate], ["Headline", o.headline], ["Ad text", o.body], ["Destination URL", o.url], ["Image", o.image ? `${o.image.w}×${o.image.h} ${o.image.type}, ${Math.round(o.image.bytes / 1024)} KB` : "none"], ["Notes", o.notes || "—"]]
    .map(([k, v]) => `<tr><td valign="top"><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("");
  const img = o.image ? `<p><a href="${BASE}/api/n/img?id=${id}">View the uploaded image</a></p>` : "";
  const emailed = await send(NOTIFY, `Ad order to review: ${o.business} (${site.name})`,
    `<p>New ad order on ${esc(site.domain)}. Check it against the <a href="${BASE}/advertise/policy">Ad Policy</a> (no competitors, adult content, gambling, weapons, drugs, crypto, political or deceptive claims).</p><table cellpadding="4">${rows}</table>${img}
     <p><b>To approve:</b> <a href="${adminLink(id, "approve")}">Approve and send payment link</a><br><b>To reject:</b> <a href="${adminLink(id, "reject")}">Reject</a></p>
     <p class="small">Each link opens a confirmation page; nothing happens until you press the button there. No payment is taken until the advertiser pays the link they receive after approval.</p>`, o.email);
  await send(o.email, `We received your ad order for ${site.name}`, `<p>Hi ${esc(o.name)},</p><p>Thanks for your ad order for ${esc(o.business)} (${esc(plan.name)}, $${plan.price / 100} for ${plan.days} days, starting ${esc(o.startDate)}).</p><p>Every ad is reviewed against our <a href="${BASE}/advertise/policy">Ad Policy</a>. If it's approved, we'll email you a secure payment link, and your ad goes live on your start date once paid. Nothing is charged until then.</p><p>— ${esc(site.name)}</p>`);
  return Response.json({ ok: true, id, emailed });
}
