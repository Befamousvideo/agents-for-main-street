import site from "../content/site.json";
import NewsletterForm from "./NewsletterForm";
import HouseAd from "./HouseAd";
import { Li, Linked } from "./nav";
import affiliates from "./affiliates";
const { isToolCard, externalRel } = affiliates;
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
  return <HouseAd />;
}
export function EmailAddress({ kind = "support" }) {
  const ads = kind === "ads";
  return (
    <img
      className="email-addr"
      src={ads ? "/images/email-advertising.png" : "/images/email-support.png"}
      alt={ads ? "Advertising email address" : "Support email address"}
      width={ads ? 324 : 390}
      height={ads ? 36 : 41}
      decoding="async"
    />
  );
}
export function MailingAddress({ className = "muted" }) {
  if (!site.mailingAddress) return null;
  return (
    <>
      <p className={className} style={{ whiteSpace: "pre-line" }}>{site.mailingAddress}</p>
      <p className={className}><EmailAddress kind="support" /></p>
    </>
  );
}
export function ToolCard({ card }) {
  const ext = /^https?:\/\//.test(card.href);
  return (
    <div className="card tool-card">
      <h3>{card.h}</h3>
      <p>{card.p}</p>
      <p>
        {card.disclosure}{" "}
        <a href={card.href} {...(ext ? { rel: externalRel(card.href), target: "_blank" } : {})}>{card.cta}</a>
      </p>
    </div>
  );
}
export function Block({ b }) {
  return (<section>
    {b.h && <h2>{b.h}</h2>}
    {b.img && <img className="hero" src={b.img.src} alt={b.img.alt} width={b.img.w} height={b.img.h} loading="lazy" />}
    {b.p && b.p.map((t, i) => isToolCard(t)
      ? <ToolCard key={i} card={t} />
      : <p key={i}><Linked t={t} /></p>)}
    {b.ol && <ol>{b.ol.map((t, i) => <Li key={i} t={t} />)}</ol>}
    {b.ul && <ul>{b.ul.map((t, i) => <Li key={i} t={t} />)}</ul>}
    {b.pre && <pre>{b.pre}</pre>}
    {b.table && <table><thead><tr>{b.table[0].map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{b.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>}
    {b.mailing && <MailingAddress />}
  </section>);
}
