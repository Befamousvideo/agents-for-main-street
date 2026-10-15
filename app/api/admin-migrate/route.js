import { list, del, get } from "@vercel/blob";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// TEMPORARY one-off: import Blob signups into Resend audience. Removed after use.
export async function POST(req) {
  const key = process.env.RESEND_API_KEY, aud = process.env.RESEND_AUDIENCE_ID;
  if (!key || req.headers.get("authorization") !== `Bearer ${key}`) return new Response("Not found", { status: 404 });
  const out = { total: 0, imported: 0, skippedTest: 0, deletedTest: 0, errors: 0 };
  let cursor;
  do {
    const r = await list({ prefix: "signups/", cursor });
    for (const b of r.blobs) {
      out.total++;
      try {
        const g = await get(b.pathname, { access: "private" });
        const rec = JSON.parse(await new Response(g.stream).text());
        if (/^signup-test\+/i.test(rec.email)) { out.skippedTest++; await del(b.url); out.deletedTest++; continue; }
        const x = await fetch(`https://api.resend.com/audiences/${aud}/contacts`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: rec.email, unsubscribed: false }) });
        if (x.ok || x.status === 409) out.imported++; else out.errors++;
        await new Promise(s => setTimeout(s, 600));
      } catch (e) { out.errors++; out.lastError = String(e && e.message).slice(0, 200); }
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return Response.json(out);
}
