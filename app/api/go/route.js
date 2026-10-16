import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { BRANDS, SELF } from "../../network";
import { findOrder } from "../../ads-lib";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cl = (s, n) => String(s || "").replace(/[^a-zA-Z0-9_\-\/.]/g, "").slice(0, n);
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const placement = cl(q.get("p"), 40) || "unknown", page = cl(q.get("pg"), 200) || "/";
  let dest, key;
  if (q.get("a")) {
    const f = await findOrder(cl(q.get("a"), 80).replace(/[\/.]/g, ""));
    if (!f || f.status !== "active") return Response.redirect(new URL("/", req.url), 302);
    dest = new URL(f.order.url); key = `paid_${f.order.id}`;
  } else {
    const b = BRANDS.find(x => x.id === q.get("b"));
    if (!b) return Response.redirect(new URL("/", req.url), 302);
    dest = new URL(b.url); key = b.id;
    dest.searchParams.set("utm_source", SELF); dest.searchParams.set("utm_medium", "house_ad");
    dest.searchParams.set("utm_campaign", b.id); dest.searchParams.set("utm_content", placement);
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && !/bot|crawl|spider|preview/i.test(req.headers.get("user-agent") || "")) {
    try { await put(`ad-clicks/${new Date().toISOString().slice(0, 10)}/${key}__${placement}__${randomBytes(6).toString("hex")}.json`,
      JSON.stringify({ brand: key, placement, page, at: new Date().toISOString() }), { access: "private", contentType: "application/json", addRandomSuffix: false }); }
    catch (e) { console.error("click log failed", e?.message); }
  }
  return Response.redirect(dest.toString(), 302);
}
