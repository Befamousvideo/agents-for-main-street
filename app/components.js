import site from "../content/site.json";
export function Newsletter() {
  return (
    <section className="card nl" id="newsletter">
      <h2>{site.newsletter.title}</h2>
      <p>{site.newsletter.blurb}</p>
      <form action="#">
        <input type="email" placeholder="you@example.com" aria-label="Email" disabled />
        <button type="button" disabled>Coming soon</button>
      </form>
      <p className="muted small">Signups open shortly. We'll never sell your email.</p>
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
    {b.ol && <ol>{b.ol.map((t, i) => <li key={i}>{t}</li>)}</ol>}
    {b.ul && <ul>{b.ul.map((t, i) => <li key={i}>{t}</li>)}</ul>}
    {b.pre && <pre>{b.pre}</pre>}
    {b.table && <table><thead><tr>{b.table[0].map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{b.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>}
  </section>);
}
