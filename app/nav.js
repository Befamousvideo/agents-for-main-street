import site from "../content/site.json";
const human = (s) => s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
const real = () => [...site.pages, ...site.static];
// Synthetic index pages for any intermediate path that has child pages but no page of its own,
// so every breadcrumb/label links somewhere real.
export function synthetic() {
  const have = new Set(real().map(p => p.path)); const out = new Map();
  for (const p of site.pages) { const parts = p.path.slice(1).split("/");
    for (let i = 1; i < parts.length; i++) { const path = "/" + parts.slice(0, i).join("/");
      if (!have.has(path) && !out.has(path)) out.set(path, { path, auto: true, title: human(parts[i - 1]), summary: `All ${site.name} pages under ${human(parts[i - 1])}.` }); } }
  return [...out.values()];
}
export const allPages = () => [...real(), ...synthetic()];
export const pageAt = (path) => allPages().find(p => p.path === path);
export const childrenOf = (path) => site.pages.filter(c => c.path.startsWith(path + "/") && c.group !== "hubs");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
// Link a list item to a page when its text names that page's title (optionally "Label: Title — description").
export function matchTitle(text) {
  const head = String(text).split(" — ")[0];
  const cands = [norm(head), norm(head.replace(/^[^:]{1,40}:\s*/, ""))];
  return site.pages.find(p => cands.includes(norm(p.title))) || null;
}
export function Li({ t }) { const m = matchTitle(t); if (!m) return <li>{t}</li>;
  const head = String(t).split(" — ")[0]; const rest = String(t).slice(head.length);
  return <li><a href={m.path}>{head}</a>{rest}</li>; }
// Group children by the next path segment under `path`.
export function grouped(path) {
  const depth = path.slice(1).split("/").filter(Boolean).length;
  const groups = new Map();
  for (const c of childrenOf(path)) { const seg = c.path.slice(1).split("/")[depth];
    const isLeaf = c.path.slice(1).split("/").length === depth + 1;
    const key = isLeaf ? "" : seg; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); }
  return [...groups.entries()].map(([seg, items]) => { const gp = seg ? `${path}/${seg}` : null; const hub = gp && pageAt(gp);
    return { seg, href: hub ? gp : null, name: hub ? (hub.auto ? hub.title : (items[0].label || hub.title)) : "", items }; });
}
export function Cards({ items }) {
  return <div className="grid">{items.map(c => <a key={c.path} className="card tile" href={c.path}>{c.label && <span className="tag">{c.label}</span>}<h3>{c.title}</h3><p>{c.summary}</p></a>)}</div>;
}
export function Listing({ path }) {
  const gs = grouped(path); if (!gs.length) return null;
  const multi = gs.length > 1 || gs[0].seg;
  return <section className="listing">{gs.map(g => <div key={g.seg || "_"}>
    {multi && g.seg && <h2>{g.href ? <a href={g.href}>{g.name}</a> : g.name} <span className="muted small">({g.items.length})</span></h2>}
    <Cards items={g.items} /></div>)}</section>;
}
