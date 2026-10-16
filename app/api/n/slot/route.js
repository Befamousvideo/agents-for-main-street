import { listPaths, getJson, blobReady } from "../../../ads-lib";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req) {
  const pg = new URL(req.url).searchParams.get("pg") || "/";
  const H = { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" };
  if (!blobReady()) return Response.json({ ad: null }, { headers: H });
  try {
    const now = Date.now();
    const ads = (await Promise.all((await listPaths("ads/active/")).map(getJson))).filter(a => a && Date.parse(a.startsAt) <= now && Date.parse(a.expiresAt) > now);
    if (!ads.length) return Response.json({ ad: null }, { headers: H });
    const feat = ads.filter(a => a.plan === "featured"); const pool = feat.length ? feat : ads;
    let h = 0; for (const c of pg) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const a = pool[h % pool.length];
    return Response.json({ ad: { id: a.id, headline: a.headline, body: a.body, name: a.business, img: a.image ? `/api/n/img?id=${encodeURIComponent(a.id)}` : null } }, { headers: H });
  } catch (e) { console.error("slot", e?.message); return Response.json({ ad: null }); }
}
