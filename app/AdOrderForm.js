"use client";
import { useState, useEffect, useRef } from "react";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export default function AdOrderForm({ plans, categories }) {
  const [state, setState] = useState("idle"); const [msg, setMsg] = useState("");
  const [hl, setHl] = useState(""); const [bd, setBd] = useState("");
  const started = useRef(Date.now()); const tsRef = useRef(null); const tsId = useRef(null);
  const [today, setToday] = useState("");
  useEffect(() => { setToday(new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }));
    if (!SITE_KEY) return; const render = () => { if (window.turnstile && tsRef.current && tsId.current == null) tsId.current = window.turnstile.render(tsRef.current, { sitekey: SITE_KEY }); };
    if (window.turnstile) render(); else { const sc = document.createElement("script"); sc.async = true; sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; sc.onload = render; document.head.appendChild(sc); } }, []);
  async function onSubmit(e) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const img = f.get("image"); if (img && img.size > 1024 * 1024) { setState("error"); setMsg("Image must be 1 MB or smaller."); return; }
    f.set("elapsed", String(Date.now() - started.current));
    if (SITE_KEY && window.turnstile && tsId.current != null) f.set("turnstile", window.turnstile.getResponse(tsId.current));
    setState("loading"); setMsg("");
    try { const r = await fetch("/api/n/order", { method: "POST", body: f }); const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setState("done"); else { setState("error"); setMsg(j.error || "Something went wrong. Please try again."); if (SITE_KEY && window.turnstile && tsId.current != null) window.turnstile.reset(tsId.current); }
    } catch { setState("error"); setMsg("Network error. Please try again."); }
  }
  if (state === "done") return <p className="nl-success" role="status"><strong>Thanks, your ad order is in.</strong> We've emailed you a confirmation. Every ad is reviewed first; if it's approved you'll get a secure payment link, and nothing is charged until you pay it.</p>;
  const busy = state === "loading";
  return (<form className="brf" onSubmit={onSubmit} encType="multipart/form-data">
    <label>Your name<input name="name" required maxLength={120} disabled={busy} /></label>
    <label>Business name<input name="business" required maxLength={160} disabled={busy} /></label>
    <label>Business website<input name="bizsite" type="url" required maxLength={300} placeholder="https://" disabled={busy} /></label>
    <label>Email<input type="email" name="email" required maxLength={254} disabled={busy} /></label>
    <label>Phone<input type="tel" name="phone" required maxLength={40} autoComplete="tel" placeholder="(949) 555-1234" disabled={busy} /></label>
    <label>Business category<select name="category" required defaultValue="" disabled={busy}><option value="" disabled>Choose one</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Placement<select name="plan" required defaultValue="" disabled={busy}><option value="" disabled>Choose one</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}: ${p.price / 100} for {p.days} days</option>)}</select></label>
    <label>Start date<input type="date" name="start" required min={today} disabled={busy} /></label>
    <label>Headline ({hl.length}/40)<input name="headline" required maxLength={40} value={hl} onChange={e => setHl(e.target.value)} disabled={busy} /></label>
    <label>Ad text ({bd.length}/120)<textarea name="body" required rows={2} maxLength={120} value={bd} onChange={e => setBd(e.target.value)} disabled={busy} /></label>
    <label>Destination URL<input name="url" type="url" required maxLength={500} placeholder="https://" disabled={busy} /></label>
    <label>Image or logo (optional, PNG/JPG, max 1 MB, 600×314 px or 300×300 logo)<input name="image" type="file" accept="image/png,image/jpeg" disabled={busy} /></label>
    <label>Anything we should know? (optional)<textarea name="notes" rows={2} maxLength={1000} disabled={busy} /></label>
    <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
    {SITE_KEY && <div ref={tsRef} style={{ margin: "12px 0" }} />}
    <label className="small brf-check"><input type="checkbox" name="agree" required disabled={busy} /><span>I've read and agree to the <a href="/advertise/policy" target="_blank">Ad Policy</a>, and I'm authorized to advertise this business.</span></label>
    <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit ad for review"}</button>
    {state === "error" && <p className="small" role="alert" style={{ color: "#b42318" }}>{msg}</p>}
  </form>);
}
