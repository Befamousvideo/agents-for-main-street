import site from "../content/site.json";
import { Newsletter, Cta, Sponsor } from "./components";
import Search from "./Search";
import { taxGroups } from "./nav";
import { faqLd, jsonLd } from "./seo";
export default function Home() {
  const h = site.home;
  const sections = h.sections.map(s => ({ ...s, items: s.group === "hubs" ? taxGroups().map(g => ({ path: g.path, label: "Group", title: g.name, summary: g.industries.map(i => i.name).join(", ") })) : site.pages.filter(p => p.group === s.group).map(p => { const seg = p.path.split("/")[2]; const g = taxGroups().find(g => g.industries.some(i => i.slug === seg)); const ind = g && g.industries.find(i => i.slug === seg); return { ...p, label: ind ? (g.name === ind.name ? ind.name : `${g.name} · ${ind.name}`) : p.label }; }) }));
  const faq = faqLd(h.faq);
  return (<>
    {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />}
    <section className="hero"><h1>{h.h1}</h1><p className="lead">{h.lead}</p>
      <div className="row gap">{h.buttons.map(b => <a key={b.href} className={b.secondary ? "btn ghost" : "btn"} href={b.href} data-cta-label={b.label} data-cta-location={b.secondary ? "hero_secondary" : "hero"}>{b.label}</a>)}</div></section>
    <Search />
    {sections.map(s => (<section key={s.group}><h2>{s.title}</h2>
      <div className="grid">{s.items.map(p => (<a key={p.path} className="card tile" href={p.path}>
        {p.label && <span className="tag">{p.label}</span>}<h3>{p.title}</h3><p>{p.summary}</p></a>))}</div></section>))}
    <Sponsor />
    <Newsletter />
    <section><h2>FAQ</h2>{h.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>
    <Cta cta={site.mainCta} />
  </>);
}
