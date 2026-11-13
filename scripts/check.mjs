#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const {
  HIGGSFIELD_AFFILIATE_URL,
  AFFILIATE_DISCLOSURE,
  isAffiliateUrl,
  externalRel,
  tokenizeLinks
} = require("../app/affiliates.js");
const ga = require("../app/ga.js");
const siteMetadata = require("../app/site-metadata.js");
const site = require("../content/site.json");

const args = new Set(process.argv.slice(2));
const lintOnly = args.has("--lint");
const typecheckOnly = args.has("--typecheck");
const piiBuildOnly = args.has("--pii-build");
let failed = 0;
function ok(msg) { console.log("ok  " + msg); }
function fail(msg) { failed++; console.error("FAIL  " + msg); }

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function syntaxCheck() {
  const files = walk(root).filter(p => [".js", ".mjs"].includes(extname(p)) && !p.includes("/scripts/check.mjs"));
  for (const f of files) {
    try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
    catch (e) { fail("syntax " + f.replace(root, "") + " " + (e.stderr || e.message).toString().trim()); continue; }
  }
  ok(`syntax-check ${files.length} js files`);
}

function unitAffiliate() {
  if (!isAffiliateUrl(HIGGSFIELD_AFFILIATE_URL)) fail("affiliate URL should be detected");
  else ok("affiliate URL detected");
  if (isAffiliateUrl("https://higgsfield.ai/")) fail("citation URL must not be marked affiliate");
  else ok("citation URL is not affiliate");
  if (externalRel(HIGGSFIELD_AFFILIATE_URL) !== "sponsored nofollow noopener") fail("affiliate rel");
  else ok("affiliate rel is sponsored nofollow noopener");
  if (externalRel("https://higgsfield.ai/") !== "noopener") fail("citation rel");
  else ok("citation rel is noopener");
  const md = tokenizeLinks("Try [Higgsfield](https://higgsfield.ai?fpr=vincent-116c2b) today.");
  const link = md.find(t => t.type === "link");
  if (!link || link.text !== "Higgsfield" || link.href !== HIGGSFIELD_AFFILIATE_URL) fail("markdown tokenize " + JSON.stringify(md));
  else ok("markdown affiliate link tokenized");
  const bare = tokenizeLinks("See https://higgsfield.ai/ for the source.");
  if (!bare.some(t => t.type === "link" && t.href === "https://higgsfield.ai/" && !isAffiliateUrl(t.href))) fail("bare citation tokenize");
  else ok("bare citation URL tokenized");
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]\d{4}/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const ALLOWED_EMAIL = new Set([
  "you@example.com",
  "vincent@storentech.com",
  "ads@agentsformainstreet.com",
  "requests@agentsformainstreet.com"
]);
const ALLOWED_PHONE = new Set(["(949) 555-1234"]);

function scanPii(label, text, { allowExisting = false } = {}) {
  const stripped = text.replace(/https?:\/\/[^\s"'<>]+/g, " ");
  const emails = [...new Set((stripped.match(EMAIL_RE) || []))];
  const phones = [...new Set((stripped.match(PHONE_RE) || []))];
  const cards = [...new Set((stripped.match(CARD_RE) || []))];
  const extraEmail = allowExisting ? emails.filter(e => !ALLOWED_EMAIL.has(e)) : emails;
  const extraPhone = allowExisting ? phones.filter(p => !ALLOWED_PHONE.has(p)) : phones;
  const extraCard = cards.filter(c => {
    const digits = c.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && !/^0+$/.test(digits);
  });
  if (extraEmail.length) fail(`${label} emails: ${extraEmail.join(", ")}`);
  else ok(`${label} no unexpected emails`);
  if (extraPhone.length) fail(`${label} phones: ${extraPhone.join(", ")}`);
  else ok(`${label} no unexpected phones`);
  if (extraCard.length) fail(`${label} card-like: ${extraCard.join(", ")}`);
  else ok(`${label} no payment PAN`);
}

function contentChecks() {
  const recipe = site.pages.find(p => p.path === "/industries/local-business/make-15-second-ai-video-ad");
  if (!recipe) { fail("recipe page missing"); return; }
  ok("recipe page exists");
  if (recipe.title !== "Make a 15-second AI video ad") fail("recipe title");
  else ok("recipe title");
  if (recipe.group !== "recipes" || !recipe.steps?.length) fail("recipe format");
  else ok("recipe has steps");
  const blob = JSON.stringify(recipe);
  if (!blob.includes(HIGGSFIELD_AFFILIATE_URL)) fail("recipe missing affiliate URL");
  else ok("recipe has affiliate URL");
  if (!blob.includes(AFFILIATE_DISCLOSURE)) fail("recipe missing disclosure");
  else ok("recipe has disclosure");
  const need = (recipe.blocks || []).find(b => b.h === "What you need");
  if (!need || need.p?.[0] !== AFFILIATE_DISCLOSURE) fail("disclosure must be What you need p[0]");
  else ok("disclosure is before the affiliate link");
  if (!need?.p?.[1]?.includes(HIGGSFIELD_AFFILIATE_URL)) fail("affiliate link must be What you need p[1]");
  else ok("affiliate link is What you need p[1]");
  if (/\b(coupon|discount|% off|promo code)\b/i.test(blob)) fail("recipe has coupon/discount wording");
  else ok("recipe has no coupon/discount wording");
  scanPii("new recipe", blob, { allowExisting: false });
}

function fakeDoc() {
  const nodes = [];
  return {
    getElementById: (id) => nodes.find(n => n.id === id) || null,
    createElement: () => ({ id: "", async: false, src: "" }),
    head: { appendChild(n) { nodes.push(n); return n; } },
    nodes
  };
}

function isArgs(x) {
  return x && !Array.isArray(x) && Object.prototype.toString.call(x) === "[object Arguments]";
}

function unitGtag() {
  const now = new Date("2026-11-13T00:00:00.000Z");
  const denied = {};
  const deniedDoc = fakeDoc();
  const deniedResult = ga.startGoogleAnalytics(denied, deniedDoc, { consent: ga.CONSENT_DENIED, id: "G-ECB8CXZGD7", now });
  if (deniedResult.started || denied.dataLayer || denied.gtag || deniedDoc.nodes.length) fail("gtag must not start without consent");
  else ok("gtag does not start when consent is denied");

  const unset = {};
  const unsetResult = ga.startGoogleAnalytics(unset, fakeDoc(), { consent: "unset", id: "G-ECB8CXZGD7", now });
  if (unsetResult.started || unset.dataLayer) fail("gtag must not start before a consent choice");
  else ok("gtag does not start before consent");

  const win = {};
  const doc = fakeDoc();
  const result = ga.startGoogleAnalytics(win, doc, { consent: ga.CONSENT_GRANTED, id: "G-ECB8CXZGD7", now });
  if (!result.started) fail("gtag should start after consent");
  else ok("gtag starts after consent");

  const layer = result.dataLayer;
  if (!layer || layer.length < 3) fail("gtag dataLayer missing consent/js/config");
  else {
    const [consentCmd, jsCmd, configCmd] = layer;
    if (!isArgs(consentCmd) || !isArgs(jsCmd) || !isArgs(configCmd)) fail("gtag pushes must be Arguments objects");
    else ok("gtag consent/js/config pushes are Arguments objects");
    const flags = consentCmd[2] || {};
    if (consentCmd[0] !== "consent" || consentCmd[1] !== "default"
      || flags.ad_storage !== "denied" || flags.ad_user_data !== "denied"
      || flags.ad_personalization !== "denied" || flags.analytics_storage !== "granted") fail("gtag consent default values");
    else ok("gtag consent default precedes js/config with denied ads and granted analytics");
    if (jsCmd[0] !== "js" || !(jsCmd[1] instanceof Date) || jsCmd[1] !== now) fail("gtag js command shape");
    else ok("gtag js command then Date");
    const cfg = configCmd[2] || {};
    if (configCmd[0] !== "config" || configCmd[1] !== "G-ECB8CXZGD7") fail("gtag config command shape");
    else ok("gtag config command then measurement ID");
    if (cfg.allow_google_signals !== false || cfg.allow_ad_personalization_signals !== false) fail("gtag config must deny Google signals and ad personalization");
    else ok("gtag config sets allow_google_signals and allow_ad_personalization_signals false");
  }

  const gtagSrc = doc.nodes.find(n => n.src && n.src.includes("googletagmanager.com/gtag/js"));
  if (!gtagSrc || !gtagSrc.src.includes("G-ECB8CXZGD7")) fail("gtag.js script not loaded after consent");
  else ok("gtag.js script loads after consent");

  if (ga.measurementId({}) !== "G-ECB8CXZGD7") fail("GA fallback ID");
  else ok("GA fallback ID is G-ECB8CXZGD7");
  if (ga.measurementId({ NEXT_PUBLIC_GA_ID: "G-CUSTOM" }) !== "G-CUSTOM") fail("GA env override");
  else ok("NEXT_PUBLIC_GA_ID overrides fallback");

  const beforeDeny = layer.length;
  const deniedLater = ga.denyAnalytics(win);
  const updateCmd = layer[layer.length - 1];
  if (!deniedLater.updated || layer.length !== beforeDeny + 1) fail("Decline after Allow must update gtag consent");
  else if (!isArgs(updateCmd) || updateCmd[0] !== "consent" || updateCmd[1] !== "update" || updateCmd[2]?.analytics_storage !== "denied") fail("gtag consent update must deny analytics_storage");
  else ok("Decline after Allow calls gtag consent update with analytics_storage denied");
  if (ga.denyAnalytics({}).updated) fail("denyAnalytics must no-op when gtag is missing");
  else ok("denyAnalytics is a no-op when gtag does not exist");
}

function memoryStore() {
  const data = Object.create(null);
  return {
    getItem: k => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null,
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}

function unitCookieSettings() {
  const store = memoryStore();
  ga.writeConsent(store, ga.CONSENT_GRANTED);
  if (ga.readConsent(store) !== ga.CONSENT_GRANTED) fail("consent store write");
  const events = [];
  const target = { dispatchEvent(e) { events.push(e.type); return true; } };
  ga.reopenConsentBar(store, target);
  if (ga.readConsent(store) !== null) fail("Cookie settings must clear the saved choice");
  else ok("Cookie settings clears the saved choice");
  if (!events.includes(ga.CONSENT_RESET_EVENT)) fail("Cookie settings must emit the reset event to re-show the bar");
  else ok("Cookie settings re-shows the bar");

  const boom = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); }
  };
  try {
    ga.writeConsent(boom, ga.CONSENT_GRANTED);
    ga.readConsent(boom);
    ga.clearConsent(boom);
    ok("consent storage errors are caught");
  } catch {
    fail("consent storage must not throw");
  }

  const layout = readFileSync(join(root, "app/layout.js"), "utf8");
  if (!layout.includes("<CookieSettings />") || !layout.includes("RSS</a> · <CookieSettings")) fail("footer must include Cookie settings button");
  else ok("footer Cookie settings button is next to the footer links");
  const bar = readFileSync(join(root, "app/AnalyticsConsent.js"), "utf8");
  if (!bar.includes('role="region"')) fail("consent bar must use role=region");
  else ok("consent bar uses role=region");
  if (!bar.includes(">Analytics<") && !/cookie-title">Analytics</.test(bar)) fail("consent bar title must be Analytics");
  else ok("consent bar title is Analytics");
  if (!bar.includes("Vercel") || !bar.includes("cookieless, aggregated analytics and performance measurement run on every page")) fail("consent bar must mention ungated Vercel analytics");
  else ok("consent bar mentions Vercel cookieless analytics");
  if (!bar.includes("ga.denyAnalytics(window)")) fail("decide() must call denyAnalytics on Decline");
  else ok("decide() denies analytics_storage when gtag exists");
}

function unitVerification() {
  const absent = siteMetadata.googleVerification({});
  const absentMeta = siteMetadata.googleVerificationMeta({});
  if (absent !== undefined || absentMeta !== null) fail("verification meta must be absent when env is unset");
  else ok("verification meta absent when env is unset");

  const token = "test-gsc-token";
  const present = siteMetadata.googleVerification({ NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: token });
  const presentMeta = siteMetadata.googleVerificationMeta({ NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: token });
  if (!present || present.google !== token) fail("verification.google should use the env value");
  else ok("verification.google set from env");
  if (!presentMeta || presentMeta.name !== "google-site-verification" || presentMeta.content !== token) fail("verification meta should render when env is set");
  else ok("verification meta renders when env is set");

  const layout = readFileSync(join(root, "app/layout.js"), "utf8");
  if (!layout.includes("siteMetadata.googleVerification()") || !/verification \? \{ verification \}/.test(layout)) fail("layout must use metadata.verification.google only when set");
  else ok("layout wires Next.js metadata.verification.google");

  const privacy = site.static.find(p => p.path === "/privacy");
  const privacyText = JSON.stringify(privacy || {});
  if (!/Google Analytics/.test(privacyText)) fail("privacy page must mention Google Analytics");
  else ok("privacy page mentions Google Analytics");
  const cookies = (privacy?.blocks || []).find(b => b.h === "Cookies, analytics, Do Not Track, and other tracking");
  const p = cookies?.p || [];
  if (!p[1]?.includes("_ga") || !p[1]?.includes("_ga_<ID>") || !p[1]?.includes("afms-analytics-consent") || !p[1]?.includes("https://www.google.com/policies/privacy/partners/") || /`/.test(p[1])) fail("privacy B2 cookies/partners wording");
  else ok("privacy names _ga cookies, localStorage key, and Google partners link");
  if (p[2] !== "Advertising-related signals (ad_storage, ad_user_data and ad_personalization) stay denied, even after you allow analytics, and we do not turn on Google Analytics advertising features.") fail("privacy B3 advertising-signals sentence");
  else ok("privacy discloses advertising signals stay denied");
  if (p[3] !== "To change your choice later, use Cookie settings in the footer. If you switch to Decline, Google Analytics stops loading on later page views; cookies Google already set stay until you clear them in your browser.") fail("privacy B4 Cookie settings sentence");
  else ok("privacy explains Cookie settings");
  if (!p[6]?.includes("runs with advertising features and Google signals turned off") || /aside from Google Analytics/.test(p[6] || "")) fail("privacy B5 cross-site sentence");
  else ok("privacy cross-site sentence matches Lexy B5");
}

function walkHtml(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkHtml(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function builtPii() {
  const nextDir = join(root, ".next");
  if (!existsSync(nextDir)) {
    fail("built pii: .next missing; run next build first");
    return;
  }
  const htmlFiles = walkHtml(join(nextDir, "server"));
  if (!htmlFiles.length) {
    fail("built pii: no HTML in .next/server");
    return;
  }
  ok(`built pii scanning ${htmlFiles.length} HTML files`);
  let combined = "";
  for (const f of htmlFiles) {
    const text = readFileSync(f, "utf8");
    combined += text + "\n";
    scanPii("built " + f.slice(root.length), text, { allowExisting: true });
  }
  if (/google-site-verification/i.test(combined) && !process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION) fail("built HTML must omit google-site-verification when env is unset");
  else ok("built HTML omits google-site-verification when env is unset");

  const privacyHtmlPath = join(nextDir, "server/app/privacy.html");
  if (!existsSync(privacyHtmlPath)) fail("built pii: privacy.html missing");
  else {
    const privacyHtml = readFileSync(privacyHtmlPath, "utf8");
    if (!privacyHtml.includes("_ga") || !privacyHtml.includes("afms-analytics-consent")) fail("built /privacy must name _ga cookies and the consent key");
    else if (privacyHtml.includes("`_ga") || privacyHtml.includes("`afms-analytics-consent") || /`_ga_/.test(privacyHtml)) fail("built /privacy must not show literal backticks around cookie names");
    else ok("built /privacy has no literal backticks around _ga / afms-analytics-consent");
  }
}

if (piiBuildOnly) {
  builtPii();
} else if (lintOnly || typecheckOnly) {
  syntaxCheck();
} else {
  unitAffiliate();
  unitGtag();
  unitCookieSettings();
  unitVerification();
  contentChecks();
  syntaxCheck();
  const files = walk(root).filter(p => !p.includes("node_modules") && !p.includes(".next"));
  for (const f of files) {
    if ([".js", ".mjs", ".json", ".css", ".md"].includes(extname(f)) || f.endsWith("site.json")) {
      const rel = f.slice(root.length);
      if (rel.startsWith("app/") || rel.startsWith("content/") || rel.startsWith("scripts/")) {
        scanPii(rel, readFileSync(f, "utf8"), { allowExisting: true });
      }
    }
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
