import { get } from "@vercel/blob";
import { findOrder } from "../../../ads-lib";
export const runtime = "nodejs";
export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const f = await findOrder(id.replace(/[^a-zA-Z0-9_-]/g, ""));
  if (!f || !f.order.image || !["active", "pending", "approved"].includes(f.status)) return new Response("Not found", { status: 404 });
  const r = await get(f.order.image.path, { access: "private" });
  if (!r || r.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(r.stream, { headers: { "Content-Type": f.order.image.type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
