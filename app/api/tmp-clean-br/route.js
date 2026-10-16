import { list, del } from "@vercel/blob";
export const runtime = "nodejs";
export async function POST(req) {
  if (req.headers.get("x-key") !== "0c92eb5380629e8bea4aec53160caf0e") return new Response("no", { status: 404 });
  const { email } = await req.json();
  const { blobs } = await list({ prefix: "build-requests/" });
  const out = [];
  for (const b of blobs) { const r = await fetch(b.downloadUrl || b.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } }); const j = await r.json().catch(() => ({})); if (j.email === email && j.business && j.business.startsWith("TEST")) { await del(b.url); out.push(b.pathname); } }
  return Response.json({ deleted: out });
}
