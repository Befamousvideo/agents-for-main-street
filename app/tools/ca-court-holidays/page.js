import holidays from "./holidays";
import Checker from "./Checker";
const { DISCLAIMER, SOURCE_LINKS } = holidays;

export const dynamic = "force-static";
export const metadata = {
  title: "California court holiday checker",
  description: "See whether California state courts are closed on a date, the next court business day, and nearby published judicial holidays.",
  alternates: { canonical: "/tools/ca-court-holidays" }
};

export default function CaCourtHolidaysPage() {
  return (
    <article className="court-tool">
      <p className="crumbs"><a href="/">Home</a></p>
      <h1>California court holiday checker</h1>
      <div className="tldr"><strong>Quick answer:</strong> Pick a date to see whether California state courts are closed that day (weekend or scheduled judicial holiday), the next court business day, and published holidays in the two weeks before and after.</div>
      <Checker />
      <p className="muted small court-disclaimer">{DISCLAIMER}</p>
      <p className="muted small">Sources: {SOURCE_LINKS.map((s, i) => (
        <span key={s.href}>{i ? "; " : ""}<a href={s.href} rel="noopener" target="_blank">{s.label}</a></span>
      ))}.</p>
    </article>
  );
}
