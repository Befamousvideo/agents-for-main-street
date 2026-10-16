import site from "../../content/site.json";
import { notFound } from "next/navigation";
import BuildRequestForm from "../BuildRequestForm";
import { Newsletter, Cta, Sponsor, Block } from "../components";
import { allPages, pageAt, childrenOf, matchTitle, Listing } from "../nav";
const all = allPages;
const find = (slug) => all().find(p => p.path === "/" + slug.join("/"));
export const dynamicParams = false;
export function generateStaticParams() { return all().map(p => ({ slug: p.path.slice(1).split("/") })); }
export async function generateMetadata({ params }) {
  const p = find((await params).slug); if (!p) return {};
  return { title: p.title, description: p.summary, alternates: { canonical: p.path }, openGraph: { title: p.title, description: p.summary, type: "article" } };
}
export default async function Page({ params }) {
  const p = find((await params).slug); if (!p) notFound();
  const hasKids = childrenOf(p.path).length > 0;
  const url = `https://${site.domain}${p.path}`;
  const parts = p.path.slice(1).split("/");
  const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: site.name, item: `https://${site.domain}/` }, ...parts.map((x, i) => ({ "@type": "ListItem", position: i + 2, name: i === parts.length - 1 ? p.title : x, item: `https://${site.domain}/${parts.slice(0, i + 1).join("/")}` }))] }];
  if (p.steps) ld.push({ "@context": "https://schema.org", "@type": "HowTo", name: p.title, description: p.summary, step: p.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })) });
  else if (p.group) ld.push({ "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.summary, dateModified: site.updated, mainEntityOfPage: url, publisher: { "@type": "Organization", name: site.name } });
  if (p.faq) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  return (<article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <p className="crumbs"><a href="/">Home</a>{parts.slice(0, -1).map((x, i) => { const h = "/" + parts.slice(0, i + 1).join("/"); const t = pageAt(h); return <span key={i}> / {t ? <a href={h}>{t.auto ? t.title : x}</a> : x}</span>; })}</p>
    <h1>{p.title}</h1>
    {p.flag && <div className="flag">⚠️ {p.flag}</div>}
    <div className="tldr"><strong>Quick answer:</strong> {p.summary}</div>
    {p.group && <p className="muted small">Last updated {site.updated}</p>}
    {p.steps && <section><h2>Steps</h2><ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>}
    {(p.blocks || []).filter(b => !(hasKids && (b.ul || b.ol) && !b.p && (b.ul || b.ol).every(t => matchTitle(t)))).map((b, i) => <Block key={i} b={b} />)}
    {hasKids && <Listing path={p.path} />}
    {p.form && p.form.live === "build-request" && <section className="card"><h2>{p.form.title}</h2><BuildRequestForm /><p className="muted small">{p.form.note}</p></section>}
    {p.form && !p.form.live && <section className="card"><h2>{p.form.title}</h2>{p.form.fields.map(f => <label key={f}>{f}<input disabled placeholder={f} /></label>)}
      <button className="btn" type="button" disabled>{p.form.button}</button><p className="muted small">{p.form.note}</p></section>}
    {p.faq && <section><h2>FAQ</h2>{p.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>}
    {p.group && <Sponsor />}
    {p.cta !== false && <Cta cta={p.cta || site.mainCta} />}
    {(p.group || p.showNewsletter) && <Newsletter />}
  </article>);
}
