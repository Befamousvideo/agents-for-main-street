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
  if (!layer || layer.length < 2) fail("gtag dataLayer missing js/config");
  else {
    const first = layer[0];
    const second = layer[1];
    if (Array.isArray(first) || Object.prototype.toString.call(first) !== "[object Arguments]") fail("gtag js push must be an Arguments object");
    else ok("gtag js push is an Arguments object");
    if (first[0] !== "js" || !(first[1] instanceof Date) || first[1] !== now) fail("gtag js command shape");
    else ok("gtag js command then Date");
    if (Array.isArray(second) || Object.prototype.toString.call(second) !== "[object Arguments]") fail("gtag config push must be an Arguments object");
    else ok("gtag config push is an Arguments object");
    if (second[0] !== "config" || second[1] !== "G-ECB8CXZGD7") fail("gtag config command shape");
    else ok("gtag config command then measurement ID");
  }

  const gtagSrc = doc.nodes.find(n => n.src && n.src.includes("googletagmanager.com/gtag/js"));
  if (!gtagSrc || !gtagSrc.src.includes("G-ECB8CXZGD7")) fail("gtag.js script not loaded after consent");
  else ok("gtag.js script loads after consent");

  if (ga.measurementId({}) !== "G-ECB8CXZGD7") fail("GA fallback ID");
  else ok("GA fallback ID is G-ECB8CXZGD7");
  if (ga.measurementId({ NEXT_PUBLIC_GA_ID: "G-CUSTOM" }) !== "G-CUSTOM") fail("GA env override");
  else ok("NEXT_PUBLIC_GA_ID overrides fallback");
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
}

if (piiBuildOnly) {
  builtPii();
} else if (lintOnly || typecheckOnly) {
  syntaxCheck();
} else {
  unitAffiliate();
  unitGtag();
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
