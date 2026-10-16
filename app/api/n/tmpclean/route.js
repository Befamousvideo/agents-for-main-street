import { listPaths, getJson, delPath } from "../../../ads-lib";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req) {
  if (new URL(req.url).searchParams.get("k") !== "010733e38c2ccb6b6525ae450940838d") return new Response("no", { status: 403 });
  const gone = [];
  for (const p of await listPaths("ads/")) { if (!p.endsWith(".json")) continue; const o = await getJson(p);
    if (o && o.email === "storentech@mail.grokbot.com") { await delPath(p); gone.push(p); if (o.image) { await delPath(o.image.path); gone.push(o.image.path); } } }
  return Response.json({ gone });
}
