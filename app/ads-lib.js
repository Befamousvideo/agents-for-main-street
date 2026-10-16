import { put, list, del, get } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "crypto";
import site from "../content/site.json";
import { SELF } from "./network";
export const NOTIFY = "vincent@storentech.com";
export const FROM = `${site.name} Ads <ads@agentsformainstreet.com>`;
export const BASE = `https://${site.domain}`;
export const PLANS = {
  rotating: { id: "rotating", name: "Sponsor slot (rotating)", price: 7900, days: 30, desc: "Your ad rotates in the ad spot on content pages for 30 days." },
  featured: { id: "featured", name: "Featured (exclusive)", price: 19900, days: 30, desc: "Your ad takes priority in the ad spot on every content page for 30 days." },
};
export const CATEGORIES = ["Software / SaaS", "Local service business", "Professional services", "Education / training", "Nonprofit / community", "Retail / e-commerce", "Other"];
export const COMPETITORS = {
  afms: "AI automation agencies, AI consultants, \"done-for-you\" automation builders, and other AI/automation recipe libraries for small businesses",
  viberescue: "app security audit or \"vibe code rescue\" services, code-review/fix-it agencies, and other AI-app security guide sites",
  ptaplaybook: "other PTA/PTO playbook, template or management products that compete directly with PTA Playbook",
};
export const competitorText = () => `${COMPETITORS[SELF] || "products that compete with this site"}, or any business that competes with StorenTech AI (AI strategy, consulting or custom AI builds)`;
const tok = () => process.env.BLOB_READ_WRITE_TOKEN;
export const blobReady = () => !!tok();
export async function putJson(path, obj) { return put(path, JSON.stringify(obj), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }); }
export async function getJson(path) {
  try { const r = await get(path, { access: "private", useCache: false }); if (!r || r.statusCode !== 200) return null; return JSON.parse(await new Response(r.stream).text()); } catch { return null; }
}
export async function listPaths(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out;
}
export async function delPath(path) { try { await del(path); } catch {} }
export async function findOrder(id) {
  for (const st of ["pending", "approved", "active", "rejected", "expired"]) { const o = await getJson(`ads/${st}/${id}.json`); if (o) return { status: st, order: o }; }
  return null;
}
export async function moveOrder(order, from, to) { await putJson(`ads/${to}/${order.id}.json`, { ...order, status: to }); if (from !== to) await delPath(`ads/${from}/${order.id}.json`); }
const secret = () => process.env.ADS_ADMIN_KEY || process.env.BLOB_READ_WRITE_TOKEN || "";
export const sign = (id, action) => createHmac("sha256", secret()).update(`${SELF}:${id}:${action}`).digest("hex").slice(0, 32);
export function verify(id, action, sig) { if (!secret() || !sig) return false; const a = Buffer.from(sign(id, action)), b = Buffer.from(String(sig)); return a.length === b.length && timingSafeEqual(a, b); }
export const adminLink = (id, action) => `${BASE}/api/n/admin?id=${encodeURIComponent(id)}&action=${action}&sig=${sign(id, action)}`;
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const clean = (v, n) => String(v || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, n);
export async function send(to, subject, html, replyTo) {
  if (!process.env.RESEND_API_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }) });
  if (!r.ok) console.error("resend failed", r.status, await r.text().catch(() => ""));
  return r.ok;
}
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;
export async function stripe(path, params, method = "POST") {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? new URLSearchParams(params) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || `stripe ${r.status}`); return j;
}
export async function activate(order, from, info = {}) {
  const now = new Date(); const start = order.startDate && new Date(order.startDate + "T00:00:00-07:00") > now ? new Date(order.startDate + "T00:00:00-07:00") : now;
  const days = (PLANS[order.plan] || PLANS.rotating).days;
  const o = { ...order, ...info, paidAt: now.toISOString(), startsAt: start.toISOString(), expiresAt: new Date(start.getTime() + days * 864e5).toISOString() };
  await moveOrder(o, from, "active");
  await send(NOTIFY, `Ad paid and scheduled: ${o.business} (${site.name})`, `<p>${esc(o.business)} paid for "${esc(PLANS[o.plan]?.name)}". The ad runs ${esc(o.startsAt.slice(0, 10))} to ${esc(o.expiresAt.slice(0, 10))}.</p><p>Remove it early: <a href="${adminLink(o.id, "remove")}">remove ad</a></p>`);
  await send(o.email, `Your ad on ${site.name} is scheduled`, `<p>Hi ${esc(o.name)},</p><p>Thanks, payment received. Your ad will run from ${esc(o.startsAt.slice(0, 10))} to ${esc(o.expiresAt.slice(0, 10))}, labeled "Ad".</p><p>— ${esc(site.name)}</p>`);
  return o;
}
