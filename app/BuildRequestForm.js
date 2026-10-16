"use client";
import { useState } from "react";
const BUDGETS = ["Under $500", "$500–$1,500", "$1,500–$5,000", "$5,000+", "Not sure yet"];
export default function BuildRequestForm() {
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("loading"); setMsg("");
    try {
      const r = await fetch("/api/build-request", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.get("name"), business: f.get("business"), industry: f.get("industry"), recipe: f.get("recipe"),
          budget: f.get("budget"), email: f.get("email"), consent: f.get("consent") === "on", website: f.get("website"), source: window.location.pathname }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setState("done"); else { setState("error"); setMsg(j.error || "Something went wrong. Please try again."); }
    } catch { setState("error"); setMsg("Network error. Please try again."); }
  }
  if (state === "done") return (<p className="nl-success" role="status"><strong>Thanks, your request is in!</strong> We've emailed you a confirmation, and StorenTech AI will follow up with a quote, usually within 2 business days.</p>);
  const busy = state === "loading";
  return (<form onSubmit={onSubmit}>
    <label>Name<input name="name" required maxLength={120} disabled={busy} /></label>
    <label>Business name<input name="business" required maxLength={160} disabled={busy} /></label>
    <label>Industry<input name="industry" required maxLength={120} placeholder="e.g. Restaurant, contractor, salon" disabled={busy} /></label>
    <label>Recipe (optional)<textarea name="recipe" rows={3} maxLength={1000} placeholder="Which automation do you want built?" disabled={busy} /></label>
    <label>Budget range<select name="budget" required defaultValue="" disabled={busy}><option value="" disabled>Choose one</option>{BUDGETS.map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Email<input type="email" name="email" required maxLength={254} placeholder="you@example.com" disabled={busy} /></label>
    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
    <label className="small"><input type="checkbox" name="consent" required disabled={busy} style={{ width: "auto", marginRight: 8 }} />I agree to be contacted by StorenTech AI about this request.</label>
    <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Request a build"}</button>
    {state === "error" && <p className="small" role="alert" style={{ color: "#b42318" }}>{msg}</p>}
  </form>);
}
