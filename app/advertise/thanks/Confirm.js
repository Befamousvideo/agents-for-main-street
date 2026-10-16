"use client";
import { useEffect, useState } from "react";
export default function Confirm() {
  const [s, setS] = useState({ state: "checking" });
  useEffect(() => { const sid = new URLSearchParams(location.search).get("session_id"); if (!sid) { setS({ state: "none" }); return; }
    fetch(`/api/n/confirm?session_id=${encodeURIComponent(sid)}`).then(r => r.json()).then(j => setS(j.ok ? { state: "ok", ...j } : { state: "pending" })).catch(() => setS({ state: "pending" })); }, []);
  if (s.state === "checking") return <p>Confirming your payment…</p>;
  if (s.state === "ok") return <p>Payment received. Your ad runs from <b>{s.startsAt.slice(0, 10)}</b> to <b>{s.expiresAt.slice(0, 10)}</b>. A confirmation email is on its way.</p>;
  return <p>We're confirming your payment. You'll get an email as soon as your ad is scheduled.</p>;
}
