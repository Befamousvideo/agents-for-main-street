"use client";
import { useEffect } from "react";
import { GA_ID, trackCtaClick } from "./analytics";

export default function CtaTracker() {
  useEffect(() => {
    if (!GA_ID) return;
    const onClick = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("[data-cta-label]");
      if (!el) return;
      trackCtaClick(el.getAttribute("data-cta-label"), el.getAttribute("data-cta-location"));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
