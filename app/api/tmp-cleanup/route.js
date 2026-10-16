import { list, del } from "@vercel/blob";
import { createHash } from "crypto";
export const runtime = "nodejs";
export async function POST(req) {
  const k = req.headers.get("x-key") || "";
  if (createHash("sha256").update(k).digest("hex") !== "549caeccfb7d7aec2adaaf06790ecc8262403a253f99b38ee1e566a103126640") return new Response("no", { status: 404 });
  const { blobs } = await list({ prefix: "build-requests/" });
  const out = [];
  for (const b of blobs) {
    const r = await fetch(b.downloadUrl || b.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
    const j = await r.json().catch(() => ({}));
    if (j.email === "storentech@mail.grokbot.com") { await del(b.url); out.push({ deleted: b.pathname }); } else out.push({ kept: b.pathname });
  }
  return Response.json(out);
}
