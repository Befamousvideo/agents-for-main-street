import site from "../content/site.json";
export const dynamic = "force-static";
export default function sitemap() { return [{ url: `https://${site.domain}/` }, ...[...site.pages, ...site.static].map(p => ({ url: `https://${site.domain}${p.path}`, lastModified: site.updated }))]; }
