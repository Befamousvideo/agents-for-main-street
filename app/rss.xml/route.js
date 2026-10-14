import site from "../../content/site.json";
export const dynamic = "force-static";
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function GET() {
  const items = site.pages.map(p => `<item><title>${esc(p.title)}</title><link>https://${site.domain}${p.path}</link><guid>https://${site.domain}${p.path}</guid><description>${esc(p.summary)}</description></item>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>https://${site.domain}/</link><description>${esc(site.description)}</description>${items}</channel></rss>`, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
