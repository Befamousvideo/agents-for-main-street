import site from "../../content/site.json";
import { taxGroups } from "../nav";
import { buildLlmsTxt } from "../seo";
export const dynamic = "force-static";
export function GET() {
  const t = buildLlmsTxt({ site, groups: taxGroups() });
  return new Response(t, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
