import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { BRANDS, SELF } from "../../network";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const clean = (s, n) => String(s || "").replace(/[^a-zA-Z0-9_\-\/.]/g, "").slice(0, n);
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const b = BRANDS.find(x => x.id === q.get("b"));
  if (!b) return Response.redirect(new URL("/", req.url), 302);
  const placement = clean(q.get("p"), 40) || "unknown", page = clean(q.get("pg"), 200) || "/";
  const dest = new URL(b.url);
  dest.searchParams.set("utm_source", SELF); dest.searchParams.set("utm_medium", "house_ad");
  dest.searchParams.set("utm_campaign", b.id); dest.searchParams.set("utm_content", placement);
  if (process.env.BLOB_READ_WRITE_TOKEN && !/bot|crawl|spider|preview/i.test(req.headers.get("user-agent") || "")) {
    const day = new Date().toISOString().slice(0, 10);
    try {
      await put(`ad-clicks/${day}/${b.id}__${placement}__${randomBytes(6).toString("hex")}.json`,
        JSON.stringify({ brand: b.id, placement, page, at: new Date().toISOString() }),
        { access: "private", contentType: "application/json", addRandomSuffix: false });
    } catch (e) { console.error("ad-click log failed", e && e.message); }
  }
  return Response.redirect(dest.toString(), 302);
}
