import site from "../content/site.json";
import { allPages, pageDateIso } from "./nav";
import { buildSitemap } from "./seo";
export const dynamic = "force-static";
export default function sitemap() {
  const updated = pageDateIso({ updated: site.updated });
  return buildSitemap({ domain: site.domain, updated, pages: allPages().map(p => ({ path: p.path, lastModified: pageDateIso(p) })) });
}
