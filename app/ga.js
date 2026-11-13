// GA4 helpers. CJS so Next and the node check script can load this file.
// gtag must push the real Arguments object: Google's snippet is
// function gtag(){dataLayer.push(arguments)} — an array or rest-params
// payload is not the same shape and will not fire /g/collect.
const GA_FALLBACK_ID = "G-ECB8CXZGD7";
const CONSENT_STORAGE_KEY = "afms-analytics-consent";
const CONSENT_GRANTED = "granted";
const CONSENT_DENIED = "denied";
const CONSENT_RESET_EVENT = "afms-consent-reset";
const GTAG_SCRIPT_ID = "ga4-gtag";
const CONSENT_DEFAULT = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "granted"
};
const GA_CONFIG_OPTIONS = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false
};

function measurementId(env) {
  const id = (env || process.env).NEXT_PUBLIC_GA_ID;
  return id || GA_FALLBACK_ID;
}

function readConsent(store) {
  try {
    if (!store || typeof store.getItem !== "function") return null;
    const v = store.getItem(CONSENT_STORAGE_KEY);
    return v === CONSENT_GRANTED || v === CONSENT_DENIED ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(store, value) {
  try {
    if (store && typeof store.setItem === "function") store.setItem(CONSENT_STORAGE_KEY, value);
  } catch {}
}

function clearConsent(store) {
  try {
    if (store && typeof store.removeItem === "function") store.removeItem(CONSENT_STORAGE_KEY);
  } catch {}
}

function reopenConsentBar(store, target) {
  clearConsent(store);
  if (target && typeof target.dispatchEvent === "function") {
    try { target.dispatchEvent(new Event(CONSENT_RESET_EVENT)); } catch {}
  }
}

function createGtag(dataLayer) {
  return function gtag() {
    dataLayer.push(arguments);
  };
}

function initGtag(gtag, id, now) {
  gtag("consent", "default", CONSENT_DEFAULT);
  gtag("js", now || new Date());
  gtag("config", id, GA_CONFIG_OPTIONS);
}

function loadGtagScript(doc, id) {
  if (!doc || typeof doc.createElement !== "function") return null;
  if (typeof doc.getElementById === "function" && doc.getElementById(GTAG_SCRIPT_ID)) return null;
  const s = doc.createElement("script");
  s.id = GTAG_SCRIPT_ID;
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  if (doc.head && typeof doc.head.appendChild === "function") doc.head.appendChild(s);
  return s;
}

function denyAnalytics(win) {
  if (!win || typeof win.gtag !== "function") return { updated: false };
  win.gtag("consent", "update", { analytics_storage: "denied" });
  return { updated: true };
}

function startGoogleAnalytics(win, doc, opts) {
  const options = opts || {};
  const consent = options.consent;
  const id = options.id || measurementId();
  const now = options.now || new Date();
  if (consent !== CONSENT_GRANTED) {
    return { started: false, dataLayer: win && win.dataLayer };
  }
  if (!win) return { started: false, dataLayer: undefined };
  win.dataLayer = win.dataLayer || [];
  if (typeof win.gtag !== "function") win.gtag = createGtag(win.dataLayer);
  if (win.__afmsGaStarted) return { started: true, dataLayer: win.dataLayer, skipped: true };
  initGtag(win.gtag, id, now);
  loadGtagScript(doc, id);
  win.__afmsGaStarted = true;
  return { started: true, dataLayer: win.dataLayer };
}

module.exports = {
  GA_FALLBACK_ID,
  CONSENT_STORAGE_KEY,
  CONSENT_GRANTED,
  CONSENT_DENIED,
  CONSENT_RESET_EVENT,
  CONSENT_DEFAULT,
  GA_CONFIG_OPTIONS,
  GTAG_SCRIPT_ID,
  measurementId,
  readConsent,
  writeConsent,
  clearConsent,
  reopenConsentBar,
  createGtag,
  initGtag,
  loadGtagScript,
  startGoogleAnalytics,
  denyAnalytics
};
