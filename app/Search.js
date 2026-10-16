"use client";
import { useEffect, useMemo, useRef, useState } from "react";
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export default function Search() {
  const [idx, setIdx] = useState(null); const [q, setQ] = useState(""); const [sel, setSel] = useState(-1); const list = useRef(null);
  useEffect(() => { fetch("/search-index.json").then(r => r.json()).then(d => setIdx(d.map(x => ({ ...x, n: norm(x.text + " " + x.title) })))).catch(() => setIdx([])); }, []);
  const res = useMemo(() => {
    const words = norm(q).split(" ").filter(Boolean); if (!words.length || !idx) return [];
    const order = { group: 0, industry: 1, recipe: 2 };
    return idx.filter(x => words.every(w => x.n.split(" ").some(t => t.startsWith(w)) || x.n.includes(w))).sort((a, b) => order[a.t] - order[b.t]).slice(0, 12);
  }, [q, idx]);
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, -1)); }
    else if (e.key === "Enter" && res.length) { e.preventDefault(); location.href = res[Math.max(sel, 0)].href; }
    else if (e.key === "Escape") { setQ(""); setSel(-1); }
  };
  const label = { group: "Group", industry: "Industry", recipe: "Recipe" };
  return (<section className="search card" id="search" role="search">
    <label htmlFor="ind-search"><strong>Find recipes for your business</strong></label>
    <input id="ind-search" type="search" autoComplete="off" placeholder="Try plumber, dentist, CPA, barber, cafe…" value={q}
      onChange={e => { setQ(e.target.value); setSel(-1); }} onKeyDown={onKey}
      role="combobox" aria-expanded={!!q.trim()} aria-controls="ind-results" aria-activedescendant={sel >= 0 ? `ind-r-${sel}` : undefined} />
    <div aria-live="polite" className="muted small">{q.trim() && idx ? (res.length ? `${res.length} result${res.length > 1 ? "s" : ""}` : "") : ""}</div>
    {q.trim() && <ul id="ind-results" role="listbox" ref={list} className="results">
      {res.map((r, i) => <li key={r.href + i} id={`ind-r-${i}`} role="option" aria-selected={i === sel} className={i === sel ? "on" : ""}>
        <a href={r.href}><span className="tag">{label[r.t]}</span> {r.title}{r.group && <span className="muted small"> — {r.group}</span>}</a></li>)}
      {idx && !res.length && <li className="none">No match — <a href="/build-it-for-me">tell us your industry</a> and we'll build it.</li>}
    </ul>}
  </section>);
}
