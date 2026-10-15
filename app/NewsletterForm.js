"use client";
import { useState } from "react";
export default function NewsletterForm() {
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("loading"); setMsg("");
    try {
      const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), website: f.get("website"), source: window.location.pathname }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setState("done"); } else { setState("error"); setMsg(j.error || "Something went wrong. Please try again."); }
    } catch { setState("error"); setMsg("Network error. Please try again."); }
  }
  if (state === "done") return (<p className="nl-success" role="status"><strong>You're on the list!</strong> Thanks for signing up. We'll never sell your email.</p>);
  return (<>
    <form onSubmit={onSubmit}>
      <input type="email" name="email" required placeholder="you@example.com" aria-label="Email" disabled={state === "loading"} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
      <button type="submit" disabled={state === "loading"}>{state === "loading" ? "Joining…" : "Join the list"}</button>
    </form>
    {state === "error" ? <p className="small" role="alert" style={{ color: "#b42318" }}>{msg}</p> : <p className="muted small">Free. Unsubscribe anytime. We'll never sell your email.</p>}
  </>);
}
