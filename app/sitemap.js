import site from "../content/site.json";
import { allPages } from "./nav";
export const dynamic = "force-static";
export default function sitemap() { return [{ url: `https://${site.domain}/` }, ...allPages().map(p => ({ url: `https://${site.domain}${p.path}`, lastModified: site.updated }))]; }
