import "./globals.css";
import site from "../content/site.json";
import HouseAd from "./HouseAd";
export const metadata = {
  metadataBase: new URL(`https://${site.domain}`),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  alternates: { canonical: "/", types: { "application/rss+xml": "/rss.xml", "text/plain": "/llms.txt" } },
  openGraph: { siteName: site.name, type: "website", title: site.name, description: site.description },
};
export default function RootLayout({ children }) {
  const org = { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: `https://${site.domain}`, parentOrganization: { "@type": "Organization", name: "StorenTech" } };
  return (
    <html lang="en" style={{ "--accent": site.color }}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
        <header className="hdr"><div className="wrap row">
          <a href="/" className="logo">{site.name}</a>
          <nav>{site.nav.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}</nav>
        </div></header>
        <main className="wrap">{children}<HouseAd skip={site.static.map(p => p.path)} /></main>
        <footer className="ftr"><div className="wrap">
          <p>{site.footer}</p>
          <p><a href="/about">About</a> · <a href="/methodology">Methodology</a> · <a href="/sponsor">Sponsor</a> · <a href="/newsletter">Newsletter</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/rss.xml">RSS</a></p>
          <p className="muted">© 2026 {site.name}, a StorenTech company. Preview build — content under review.</p>
        </div></footer>
      </body>
    </html>
  );
}
