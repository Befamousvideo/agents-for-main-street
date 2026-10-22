import "./globals.css";
import site from "../content/site.json";
import GoogleAnalytics from "./GoogleAnalytics";
import CtaTracker from "./CtaTracker";
import { jsonLd, organizationGraph, pageMeta } from "./seo";
const homeTitle = `${site.name} — ${site.tagline}`;
export const metadata = {
  metadataBase: new URL(`https://${site.domain}`),
  ...pageMeta({ title: homeTitle, description: site.description, path: "/", siteName: site.name, absoluteTitle: true }),
  title: { default: homeTitle, template: `%s | ${site.name}` },
  alternates: { canonical: "/", types: { "application/rss+xml": "/rss.xml", "text/plain": "/llms.txt" } },
};
export default function RootLayout({ children }) {
  const graph = organizationGraph({ name: site.name, domain: site.domain, description: site.description, parentName: "StorenTech" });
  return (
    <html lang="en" style={{ "--accent": site.color }}>
      <body>
        <GoogleAnalytics />
        <CtaTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
        <header className="hdr"><div className="wrap row">
          <a href="/" className="logo">{site.name}</a>
          <nav>{site.nav.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}<a href="/industries#search" aria-label="Search recipes">🔍 Search</a></nav>
        </div></header>
        <main className="wrap">{children}</main>
        <footer className="ftr"><div className="wrap">
          <p>{site.footer}</p>
          <p><a href="/about">About</a> · <a href="/methodology">Methodology</a> · <a href="/advertise">Advertise</a> · <a href="/newsletter">Newsletter</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/rss.xml">RSS</a></p>
          <p className="muted">© 2026 {site.name}, a StorenTech company. Preview build — content under review.</p>
        </div></footer>
      </body>
    </html>
  );
}
