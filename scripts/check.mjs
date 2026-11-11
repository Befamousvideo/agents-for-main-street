#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
const site = require("../content/site.json");

const args = new Set(process.argv.slice(2));
const lintOnly = args.has("--lint");
const typecheckOnly = args.has("--typecheck");
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
const ALLOWED_EMAIL_RE = /@(?:example|agentsformainstreet|storentech)\.com$/i;
const ALLOWED_PHONE = new Set(["(949) 555-1234"]);
const B64_RE = /[A-Za-z0-9+/]{16,}={0,2}/g;
const HEX_RE = /\b(?:[0-9a-fA-F]{2}){8,64}\b/g;
const FROM_CHAR_RE = /(?:String\.)?fromCharCode\s*\(([\d\s,]+)\)/g;

function allowedEmail(e) {
  return ALLOWED_EMAIL_RE.test(String(e || "").trim());
}

function emailsInDecoded(raw) {
  const s = String(raw || "").replace(/[\u0000-\u001f]+/g, "").trim();
  if (!s || s.length > 80 || !/^[ -~]+$/.test(s)) return [];
  const m = s.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/);
  return m ? [m[0]] : [];
}

function encodedEmails(text) {
  const found = [];
  for (const tok of text.match(B64_RE) || []) {
    if (tok.length % 4) continue;
    try { found.push(...emailsInDecoded(Buffer.from(tok, "base64").toString("utf8"))); }
    catch {}
  }
  for (const tok of text.match(HEX_RE) || []) {
    if (tok.length % 2) continue;
    try { found.push(...emailsInDecoded(Buffer.from(tok, "hex").toString("utf8"))); }
    catch {}
  }
  for (const m of text.matchAll(FROM_CHAR_RE)) {
    const codes = m[1].split(",").map(n => Number(n.trim())).filter(n => Number.isInteger(n) && n >= 0 && n <= 0x10ffff);
    if (!codes.length) continue;
    try { found.push(...emailsInDecoded(String.fromCharCode(...codes))); }
    catch {}
  }
  return [...new Set(found)];
}

function scanPii(label, text, { allowExisting = false } = {}) {
  const stripped = text.replace(/https?:\/\/[^\s"'<>]+/g, " ");
  const emails = [...new Set((stripped.match(EMAIL_RE) || []))];
  const phones = [...new Set((stripped.match(PHONE_RE) || []))];
  const cards = [...new Set((stripped.match(CARD_RE) || []))];
  const extraEmail = allowExisting ? emails.filter(e => !allowedEmail(e)) : emails;
  const extraPhone = allowExisting ? phones.filter(p => !ALLOWED_PHONE.has(p)) : phones;
  const extraCard = cards.filter(c => {
    const digits = c.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && !/^0+$/.test(digits);
  });
  const extraEncoded = encodedEmails(stripped);
  if (extraEmail.length) fail(`${label} emails: ${extraEmail.join(", ")}`);
  else ok(`${label} no unexpected emails`);
  if (extraEncoded.length) fail(`${label} encoded emails`);
  else ok(`${label} no encoded emails`);
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

if (lintOnly || typecheckOnly) {
  syntaxCheck();
} else {
  unitAffiliate();
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
