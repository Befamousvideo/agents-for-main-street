"use client";
import { useState } from "react";
import { track } from "@vercel/analytics";
import NewsletterForm from "../../NewsletterForm";
import dataset from "../../../content/ca-court-holidays.json";
import holidays from "./holidays";
const { COUNTIES, checkCourtDay } = holidays;

export default function Checker() {
  const [date, setDate] = useState("");
  const [county, setCounty] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function onSubmit(e) {
    e.preventDefault();
    const r = checkCourtDay(date, dataset, county);
    if (!r.ok) { setResult(null); setError(r.error); return; }
    setError("");
    setResult(r);
    try {
      track("tool_result", { tool: "ca-court-holidays", closed: r.closed || r.likelyClosed ? "1" : (r.notCovered ? "na" : "0") });
    } catch { /* analytics is optional */ }
  }

  return (
    <>
      <section className="card">
        <form onSubmit={onSubmit}>
          <label htmlFor="court-date">Date <span className="muted">(required)</span>
            <input id="court-date" type="date" name="date" required min="2026-01-01" max="2027-12-31" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label htmlFor="court-county">California county <span className="muted">(optional; display and court locator only)</span>
            <select id="court-county" name="county" value={county} onChange={e => setCounty(e.target.value)}>
              <option value="">Statewide result — no county</option>
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Check this date</button>
        </form>
      </section>
      {error && <p className="small" role="alert" style={{ color: "#b42318" }}>{error}</p>}
      {result && <Result result={result} />}
    </>
  );
}

function Result({ result }) {
  const showStatewideNext = result.nextBusinessDay && !result.notCovered && !result.nextOutsideCoverage;
  const showOutsideNext = result.nextBusinessDay && !result.notCovered && result.nextOutsideCoverage;
  return (
    <>
      <section className="card" aria-live="polite">
        <p className={"court-status " + result.statusKind}>{result.status}</p>
        <p>{result.reason}</p>
        {result.confirmCaveat && <p>{result.confirmCaveat}</p>}
        {result.farmworkersNote && <p>{result.farmworkersNote}</p>}
        {showStatewideNext && (
          <p>Next court business day (statewide list): <strong>{result.nextBusinessDayLabel}</strong></p>
        )}
        {showOutsideNext && (
          <p>{result.nextOutsideLabel}: <strong>{result.nextBusinessDayLabel}</strong></p>
        )}
        {result.county && (
          <p>This result uses the statewide holiday list. It does not reflect {result.county} County closures or hours; you can find the court's contact information with the{" "}
            <a href={result.countyLocatorUrl} rel="noopener" target="_blank">Judicial Branch court locator</a>.</p>
        )}
        <h2>Court holidays within 14 days</h2>
        {result.nearby.length ? (
          <ul className="court-holidays">{result.nearby.map(h => (
            <li key={h.date}>{h.listText}</li>
          ))}</ul>
        ) : <p className="muted">No published judicial holidays in this dataset within 14 days of {result.dateLabel}.</p>}
        <p className="muted small">Source: <a href={result.sourceUrl} rel="noopener" target="_blank">{result.sourceTitle}</a> · Last checked: {result.lastCheckedLabel}</p>
        <p className="muted small">{result.disclaimer}</p>
      </section>
      <section className="card nl">
        <h2>Get a weekly plain-English AI tip for professional services and law firms. Join the list.</h2>
        <NewsletterForm />
        <p className="small"><a href="/industries/professional-services">Law and professional-services recipes</a></p>
      </section>
    </>
  );
}
