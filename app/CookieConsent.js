"use client";
import { useEffect, useState } from "react";
import { consentBootSource, consentCookie, normalizeChoice, readChoice, CONSENT_STORAGE_KEY } from "../lib/consent.mjs";

function persist(choice) {
  try { localStorage.setItem(CONSENT_STORAGE_KEY, choice); } catch { /* private mode */ }
  document.cookie = consentCookie(choice, { secure: location.protocol === "https:" });
  document.documentElement.setAttribute("data-consent", choice);
  const s = document.createElement("script");
  s.text = consentBootSource(process.env.NEXT_PUBLIC_GA_ID);
  document.head.appendChild(s);
}

export default function CookieConsent() {
  const [choice, setChoice] = useState(undefined);
  useEffect(() => {
    setChoice(readChoice(localStorage, document.cookie));
    if (document.getElementById("consent-boot-rerun")) return;
    const s = document.createElement("script");
    s.id = "consent-boot-rerun";
    s.text = consentBootSource(process.env.NEXT_PUBLIC_GA_ID);
    document.head.appendChild(s);
  }, []);
  function choose(next) {
    if (!normalizeChoice(next)) return;
    persist(next);
    setChoice(next);
  }
  if (choice !== null) return null;
  return (
    <div className="consent" role="region" aria-label="Cookie consent">
      <p>We store this choice on your device. Analytics stay off unless you accept. <a href="/privacy">Privacy policy</a></p>
      <div className="consent-actions">
        <button type="button" className="btn consent-btn" onClick={() => choose("rejected")}>Reject</button>
        <button type="button" className="btn consent-btn" onClick={() => choose("accepted")}>Accept</button>
      </div>
    </div>
  );
}
