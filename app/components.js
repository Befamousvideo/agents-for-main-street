import site from "../content/site.json";
import NewsletterForm from "./NewsletterForm";
import { Li } from "./nav";
export function Newsletter() {
  return (
    <section className="card nl" id="newsletter">
      <h2>{site.newsletter.title}</h2>
      <p>{site.newsletter.blurb}</p>
      <NewsletterForm />
    </section>
  );
}
export function Cta({ cta }) {
  if (!cta) return null;
  return (<section className="card cta"><h2>{cta.title}</h2><p>{cta.text}</p><a className="btn" href={cta.href}>{cta.button}</a></section>);
}
export function Sponsor() {
  return (<aside className="sponsor"><span className="tag">Sponsor slot</span> {site.sponsorSlot} <a href="/sponsor">Learn more →</a></aside>);
}
export function Block({ b }) {
  return (<section>
    {b.h && <h2>{b.h}</h2>}
    {b.p && b.p.map((t, i) => <p key={i}>{t}</p>)}
    {b.ol && <ol>{b.ol.map((t, i) => <Li key={i} t={t} />)}</ol>}
    {b.ul && <ul>{b.ul.map((t, i) => <Li key={i} t={t} />)}</ul>}
    {b.pre && <pre>{b.pre}</pre>}
    {b.table && <table><thead><tr>{b.table[0].map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{b.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>}
  </section>);
}
