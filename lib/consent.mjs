/** First-party consent. Values are only "accepted" or "rejected" — never contact or payment data. */

export const GA_FALLBACK_ID = "G-ECB8CXZGD7";
export const CONSENT_STORAGE_KEY = "ams-consent";
export const CONSENT_COOKIE = "ams_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

const GA_ID_RE = /^G-[A-Z0-9]{4,32}$/;

export const CONSENT_DEFAULT_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
};

export const ANALYTICS_GRANTED_UPDATE = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
};

export const ANALYTICS_DENIED_UPDATE = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
};

export function normalizeChoice(value) {
  return value === "accepted" || value === "rejected" ? value : null;
}

export function resolveGaId(envValue) {
  const raw = typeof envValue === "string" ? envValue.trim() : "";
  return GA_ID_RE.test(raw) ? raw : GA_FALLBACK_ID;
}

export function consentCookie(choice, { secure = false } = {}) {
  const c = normalizeChoice(choice);
  if (!c) throw new Error("invalid consent");
  return `${CONSENT_COOKIE}=${c}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function parseConsentCookie(cookieString) {
  const raw = String(cookieString || "");
  const m = raw.match(new RegExp("(?:^|; )" + CONSENT_COOKIE + "=(accepted|rejected)(?:;|$)"));
  return m ? m[1] : null;
}

export function readChoice(storage, cookieString) {
  let ls = null;
  try {
    ls = storage && typeof storage.getItem === "function" ? storage.getItem(CONSENT_STORAGE_KEY) : null;
  } catch {
    ls = null;
  }
  return normalizeChoice(ls) || parseConsentCookie(cookieString);
}

/** Self-contained boot. Loads gtag.js only when the stored choice is accepted. */
export function consentBootSource(envValue) {
  const id = resolveGaId(envValue);
  const cookieRe = `(?:^|; )${CONSENT_COOKIE}=(accepted|rejected)(?:;|$)`;
  return `(function(){
    var KEY=${JSON.stringify(CONSENT_STORAGE_KEY)};
    var GA=${JSON.stringify(id)};
    function choice(){
      var ls=null;
      try{ls=localStorage.getItem(KEY);}catch(e){}
      if(ls==="accepted"||ls==="rejected")return ls;
      var m=document.cookie.match(/${cookieRe}/);
      return m?m[1]:null;
    }
    function tagPresent(){
      return !!(window.google_tag_manager||document.querySelector('script[src*="googletagmanager.com"],script[src*="google-analytics.com"],script[src*="googleadservices.com"]'));
    }
    function ensureDefault(){
      window.dataLayer=window.dataLayer||[];
      window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
      if(window.__amsConsentDefault)return;
      window.__amsConsentDefault=true;
      window.gtag("consent","default",${JSON.stringify(CONSENT_DEFAULT_DENIED)});
      window.gtag("set","ads_data_redaction",true);
    }
    var c=choice();
    if(c&&document.documentElement)document.documentElement.setAttribute("data-consent",c);
    if(c==="accepted"){
      if(!document.getElementById("ga4-loader")){
        ensureDefault();
        window.gtag("consent","update",${JSON.stringify(ANALYTICS_GRANTED_UPDATE)});
        window.gtag("js",new Date());
        window.gtag("config",GA,{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});
        var s=document.createElement("script");
        s.id="ga4-loader";
        s.async=true;
        s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(GA);
        if(document.head)document.head.appendChild(s);
      }
      return;
    }
    if(tagPresent())ensureDefault();
    if(c==="rejected"&&typeof window.gtag==="function")window.gtag("consent","update",${JSON.stringify(ANALYTICS_DENIED_UPDATE)});
  })();`;
}
