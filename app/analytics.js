// @ts-check
/** GA4 measurement IDs only. Anything else, including an empty value, disables the tag. */
const GA_ID_RE = /^G-[A-Z0-9]+$/i;
const PII_RE = /@|\b\d{3}[-.\s)]+\d{3}[-.\s]+\d{4}\b/;

/** @param {unknown} value */
export function normalizeGaId(value) {
  const id = String(value ?? "").trim();
  return GA_ID_RE.test(id) ? id : "";
}

export const GA_ID = normalizeGaId(process.env.NEXT_PUBLIC_GA_ID);

/**
 * @param {unknown} label
 * @param {unknown} location
 * @returns {{ cta_label: string, cta_location: string } | null}
 */
export function ctaParams(label, location) {
  const cta_label = String(label ?? "").trim().slice(0, 120);
  const cta_location = String(location ?? "").trim().slice(0, 80);
  if (!cta_label || !cta_location) return null;
  if (PII_RE.test(cta_label) || PII_RE.test(cta_location)) return null;
  return { cta_label, cta_location };
}

/**
 * Sends only generate_lead (no params) or cta_click {cta_label, cta_location}.
 * @param {((...args: unknown[]) => void) | undefined} gtag
 * @param {string} gaId
 * @param {string} event
 * @param {Record<string, unknown>=} params
 */
export function sendEvent(gtag, gaId, event, params) {
  if (!gaId || typeof gtag !== "function") return false;
  if (event === "generate_lead") {
    gtag("event", "generate_lead");
    return true;
  }
  if (event === "cta_click") {
    const safe = ctaParams(params && params.cta_label, params && params.cta_location);
    if (!safe) return false;
    gtag("event", "cta_click", safe);
    return true;
  }
  return false;
}

function browserGtag() {
  if (typeof window === "undefined") return undefined;
  const w = /** @type {Window & { gtag?: (...args: unknown[]) => void }} */ (window);
  return w.gtag;
}

export function trackGenerateLead() {
  sendEvent(browserGtag(), GA_ID, "generate_lead");
}

/** @param {string | null} label @param {string | null} location */
export function trackCtaClick(label, location) {
  sendEvent(browserGtag(), GA_ID, "cta_click", { cta_label: label ?? "", cta_location: location ?? "" });
}

/** @param {unknown} gaId */
export function gaBootstrap(gaId) {
  const id = normalizeGaId(gaId);
  if (!id) return null;
  const config = JSON.stringify(id);
  return {
    src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
    inline: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', ${config}, { anonymize_ip: true, page_location: window.location.origin + window.location.pathname });`,
  };
}
