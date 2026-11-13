"use client";
import { useEffect, useState } from "react";
import ga from "./ga";

export default function AnalyticsConsent() {
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    setChoice(ga.readConsent(window.localStorage) || "unset");
  }, []);

  useEffect(() => {
    if (choice !== ga.CONSENT_GRANTED) return;
    ga.startGoogleAnalytics(window, document, { consent: choice });
  }, [choice]);

  function decide(value) {
    ga.writeConsent(window.localStorage, value);
    setChoice(value);
  }

  if (choice !== "unset") return null;
  return (
    <div className="cookie" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-desc">
      <div className="wrap cookie-row">
        <div>
          <p id="cookie-title" className="cookie-title">Analytics cookies</p>
          <p id="cookie-desc">We use Google Analytics to understand how the site is used, only if you allow it. See our <a href="/privacy">privacy policy</a>.</p>
        </div>
        <div className="cookie-actions">
          <button type="button" className="btn" data-consent="allow" onClick={() => decide(ga.CONSENT_GRANTED)}>Allow analytics</button>
          <button type="button" className="btn ghost" data-consent="deny" onClick={() => decide(ga.CONSENT_DENIED)}>Decline</button>
        </div>
      </div>
    </div>
  );
}
