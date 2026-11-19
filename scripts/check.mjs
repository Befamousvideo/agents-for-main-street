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
const {
  DISCLAIMER,
  NOT_COVERED_TEXT,
  CONFIRM_AMBIGUOUS,
  FARMWORKERS_NOTE,
  NEXT_OUTSIDE_LABEL,
  LIKELY_CLOSED_LIST_SUFFIX,
  SOURCE_LINKS,
  COUNTIES,
  checkCourtDay,
  holidaysInWindow,
  nextBusinessDay,
  outputHasForbidden
} = require("../app/tools/ca-court-holidays/holidays.js");
const site = require("../content/site.json");
const courtHolidays = require("../content/ca-court-holidays.json");

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

function unitCourtHolidays() {
  const xmas = checkCourtDay("2026-12-25", courtHolidays);
  if (!xmas.ok || !xmas.closed) fail("2026-12-25 should be closed");
  else ok("2026-12-25 is closed");
  if (xmas.nextBusinessDay !== "2026-12-28") fail("2026-12-25 next business day " + xmas.nextBusinessDay);
  else ok("2026-12-25 next business day is 2026-12-28");
  if (xmas.holidayName !== "Christmas Day") fail("2026-12-25 holiday name");
  else ok("2026-12-25 is Christmas Day");
  const xmasNear = (xmas.nearby || []).map(h => h.date).sort();
  const expectXmasNear = ["2026-12-25", "2027-01-01"];
  if (xmasNear.join(",") !== expectXmasNear.join(",")) fail("2026-12-25 nearby " + xmasNear.join(","));
  else ok("2026-12-25 +/-14 day holiday list");

  const sat = checkCourtDay("2026-12-26", courtHolidays);
  if (!sat.ok || !sat.closed || !sat.weekend) fail("weekend should be closed");
  else ok("weekend date is closed");
  if (sat.nextBusinessDay !== "2026-12-28") fail("weekend next business day " + sat.nextBusinessDay);
  else ok("weekend next business day is 2026-12-28");

  const open = checkCourtDay("2026-03-04", courtHolidays);
  if (!open.ok || open.closed || open.likelyClosed || open.notCovered) fail("ordinary weekday should not be a court holiday");
  else ok("ordinary weekday is not a court holiday");
  if (open.status !== "Not a court holiday: " + open.dateLabel) fail("ordinary weekday status " + open.status);
  else ok("ordinary weekday uses Not a court holiday label");
  if (open.reason !== "Not a weekend or a published statewide court holiday.") fail("ordinary weekday reason");
  else ok("ordinary weekday reason");
  if (open.nextBusinessDay !== "2026-03-05") fail("ordinary weekday next " + open.nextBusinessDay);
  else ok("ordinary weekday next business day");

  const around = holidaysInWindow("2026-11-20", courtHolidays, 14).map(h => h.date);
  const expectAround = ["2026-11-11", "2026-11-26", "2026-11-27"];
  if (around.join(",") !== expectAround.join(",")) fail("+/-14 list " + around.join(","));
  else ok("+/-14 day list around 2026-11-20");

  const empty = holidaysInWindow("2026-04-15", courtHolidays, 14);
  if (empty.length) fail("2026-04-15 should have no nearby holidays");
  else ok("empty +/-14 list on ordinary mid-April date");

  if (COUNTIES.length !== 58) fail("expected 58 CA counties, got " + COUNTIES.length);
  else ok("58 California counties for link-out");

  const withCounty = checkCourtDay("2026-03-04", courtHolidays, "Los Angeles");
  if (withCounty.county !== "Los Angeles" || withCounty.closed) fail("county should be display-only");
  else ok("county is display/link-out only");

  const amb = (courtHolidays.ambiguous || []).some(a => a.date === "2027-12-31");
  const listed = (courtHolidays.holidays || []).some(h => h.date === "2027-12-31");
  if (!amb || listed) fail("2027-12-31 must be marked ambiguous, not a holiday");
  else ok("2027-12-31 is recorded as ambiguous, not a holiday");
  const nyeEve = checkCourtDay("2027-12-31", courtHolidays);
  if (!nyeEve.ok || nyeEve.closed || nyeEve.holidayName) fail("2027-12-31 must not be a published statewide holiday");
  else ok("2027-12-31 is not in holidays[]");
  if (!nyeEve.likelyClosed || nyeEve.status !== "Likely closed: New Year's Day 2028 (observed)") fail("2027-12-31 status " + nyeEve.status);
  else ok("2027-12-31 is Likely closed: New Year's Day 2028 (observed)");
  if (nyeEve.reason !== courtHolidays.ambiguous[0].detail) fail("2027-12-31 detail text");
  else ok("2027-12-31 uses Lexy detail text");
  if (nyeEve.confirmCaveat !== CONFIRM_AMBIGUOUS) fail("2027-12-31 confirm caveat");
  else ok("2027-12-31 confirm-with-court caveat");
  if (nextBusinessDay("2027-12-30", courtHolidays) === "2027-12-31") fail("next day after 2027-12-30 must skip ambiguous 12/31");
  else ok("nextBusinessDay skips 2027-12-31");
  const dec30 = checkCourtDay("2027-12-30", courtHolidays);
  if (dec30.nextBusinessDay === "2027-12-31") fail("2027-12-30 next should not be 12/31");
  else ok("2027-12-30 next is " + dec30.nextBusinessDay);
  if (!dec30.nextOutsideCoverage) fail("2027-12-30 next should be outside 2026–2027 coverage");
  else ok("2027-12-30 next is labeled as outside coverage");
  if (NEXT_OUTSIDE_LABEL !== "Next weekday that is not a weekend, a listed 2026–2027 holiday, or a date marked likely closed (2028 court holidays are not in this checker yet)") fail("NEXT_OUTSIDE_LABEL text");
  else ok("NEXT_OUTSIDE_LABEL is Lexy R2 wording");
  if (dec30.nextOutsideLabel !== NEXT_OUTSIDE_LABEL) fail("2027-12-30 next-outside label");
  else ok("2027-12-30 uses NEXT_OUTSIDE_LABEL");
  const likelyList = "Friday, December 31, 2027 — New Year's Day 2028 (observed)" + LIKELY_CLOSED_LIST_SUFFIX;
  if (!(dec30.nearby || []).some(h => h.listText === likelyList && h.likelyClosed)) fail("2027-12-30 nearby missing likely-closed 12/31: " + (dec30.nearby || []).map(h => h.listText).join(" | "));
  else ok("2027-12-30 ±14 list includes likely-closed 12/31");
  const dec20 = checkCourtDay("2027-12-20", courtHolidays);
  if (!(dec20.nearby || []).some(h => h.listText === likelyList && h.likelyClosed)) fail("2027-12-20 nearby missing likely-closed 12/31");
  else ok("2027-12-20 ±14 list includes likely-closed 12/31");

  const xmas25 = checkCourtDay("2025-12-25", courtHolidays);
  if (!xmas25.notCovered || xmas25.closed || xmas25.status !== "Not covered") fail("2025-12-25 should be Not covered, not Open");
  else ok("2025-12-25 is Not covered");
  if (xmas25.reason !== NOT_COVERED_TEXT) fail("2025-12-25 coverage text");
  else ok("2025-12-25 uses Lexy Not-covered text");
  if (xmas25.nextBusinessDay) fail("2025-12-25 should not show a next court business day");
  else ok("2025-12-25 does not invent a next court business day");

  const sat25 = checkCourtDay("2025-12-27", courtHolidays);
  if (!sat25.closed || !sat25.weekend) fail("Saturday outside coverage should still be closed");
  else ok("Saturday outside coverage is still closed");

  const fw = checkCourtDay("2027-04-09", courtHolidays);
  if (!fw.closed || fw.holidayName !== "Farmworkers Day (formerly Cesar Chavez Day)") fail("2027-04-09 Farmworkers Day");
  else ok("2027-04-09 remains Farmworkers Day");
  if (fw.farmworkersNote !== FARMWORKERS_NOTE) fail("Farmworkers note on 2027-04-09");
  else ok("Farmworkers note on 2027-04-09");
  const mar31 = checkCourtDay("2027-03-31", courtHolidays);
  if (mar31.closed || mar31.farmworkersNote !== FARMWORKERS_NOTE) fail("2027-03-31 should not be a holiday and should show Farmworkers note");
  else ok("2027-03-31 is not a statewide holiday, with Farmworkers note");

  const page = readFileSync(join(root, "app/tools/ca-court-holidays/page.js"), "utf8");
  const checker = readFileSync(join(root, "app/tools/ca-court-holidays/Checker.js"), "utf8");
  if (!page.includes("{DISCLAIMER}") && !page.includes(DISCLAIMER)) fail("disclaimer missing from page");
  else ok("disclaimer on page");
  if (page.includes("[CONFIRM: Lexy/Tony wording]") || checker.includes("[CONFIRM: Lexy/Tony wording]")) fail("CONFIRM comment must be removed");
  else ok("CONFIRM comment removed");
  if (DISCLAIMER.includes("CONFIRM")) fail("CONFIRM leaked into visible disclaimer");
  else ok("CONFIRM is not in visible disclaimer");
  if (DISCLAIMER !== "Information only, not legal advice. This page shows the statewide California judicial holidays published by the Judicial Branch for 2026 and 2027. It does not calculate filing deadlines or count court days. Federal courts follow a different holiday schedule. A court can also close for emergencies or local reasons, so check with that court's clerk before relying on a date. This site is not affiliated with the California courts.") fail("disclaimer text");
  else ok("disclaimer is Lexy's wording");
  const holidaySrc = readFileSync(join(root, "app/tools/ca-court-holidays/holidays.js"), "utf8");
  if (!page.includes("SOURCE_LINKS") || !holidaySrc.includes("Code of Civil Procedure section 135") || !holidaySrc.includes("California Rules of Court, rule 1.11")) fail("page sources line missing CCP 135 / CRC 1.11");
  else ok("page sources line links CCP 135 and CRC 1.11");
  if (!checker.includes("Get a weekly plain-English AI tip for professional services and law firms. Join the list.")) fail("CTA copy missing");
  else ok("CTA copy present");
  if (!checker.includes("NewsletterForm")) fail("CTA not wired to existing newsletter form");
  else ok("CTA uses existing NewsletterForm");
  if (!checker.includes("/api/subscribe") && !readFileSync(join(root, "app/NewsletterForm.js"), "utf8").includes("/api/subscribe")) fail("newsletter endpoint missing");
  else ok("newsletter uses existing /api/subscribe");
  if (!checker.includes("/industries/professional-services")) fail("professional-services recipes link missing");
  else ok("link to professional-services recipes");
  if (!checker.includes('track("tool_result"') && !checker.includes("track('tool_result'")) fail("tool_result analytics event missing");
  else ok("optional tool_result analytics event");
  if (!checker.includes('min="2026-01-01"') || !checker.includes('max="2027-12-31"')) fail("date picker min/max missing");
  else ok("date picker limited to 2026-01-01 through 2027-12-31");
  if (!nyeEve.confirmCaveat || !/Confirm with the court before relying on this date/.test(nyeEve.confirmCaveat)) fail("2027-12-31 confirm-with-court caveat missing");
  else ok("2027-12-31 still has confirm-with-court caveat");
  if (!/This site is not affiliated with the California courts/.test(DISCLAIMER)) fail("disclaimer affiliation line missing");
  else ok("disclaimer still says not affiliated with the California courts");
  if (site.nav.some(n => String(n.href).includes("ca-court-holidays"))) fail("tool must not be in nav");
  else ok("tool is not in nav");
  const homeBlob = JSON.stringify(site.home || {});
  if (homeBlob.includes("ca-court-holidays")) fail("tool must not be on homepage");
  else ok("tool is not on homepage");
  const resultBlob = JSON.stringify({ ...xmas, disclaimer: undefined });
  const holidaysCopy = [
    DISCLAIMER,
    NOT_COVERED_TEXT,
    CONFIRM_AMBIGUOUS,
    FARMWORKERS_NOTE,
    NEXT_OUTSIDE_LABEL,
    LIKELY_CLOSED_LIST_SUFFIX,
    "Enter a valid date as YYYY-MM-DD.",
    "Not a weekend or a published statewide court holiday.",
    ...(SOURCE_LINKS || []).map(s => s.label)
  ].join("\n");
  const renderedResults = JSON.stringify([dec30, nyeEve, xmas25]);
  if (
    outputHasForbidden(holidaysCopy) ||
    outputHasForbidden(renderedResults) ||
    outputHasForbidden(resultBlob) ||
    /you must file by|AI lawyer|last day to file|deadline is|you should/i.test(page + checker)
  ) fail("forbidden advice/deadline wording");
  else ok("no deadline, statute, or advice wording in holidays.js copy or rendered results");
  if (checker.includes("nextAmbiguous")) fail("dead nextAmbiguous display branch still present");
  else ok("nextAmbiguous display branch removed");
  if (!/does not calculate filing deadlines/.test(DISCLAIMER)) fail("disclaimer must say this tool does not calculate filing deadlines");
  else ok("disclaimer states the tool does not calculate filing deadlines");
  if (!checker.includes("Next court business day (statewide list)")) fail("next-day label missing statewide qualifier");
  else ok("next-day label includes statewide list");
  if (!checker.includes("This result uses the statewide holiday list. It does not reflect")) fail("county line missing Lexy wording");
  else ok("county line uses Lexy wording");
  const sources = (courtHolidays.sources || []).map(s => s.url);
  if (!sources.includes("https://courts.ca.gov/about/court-holidays")) fail("primary courts.ca.gov source missing");
  else ok("official courts.ca.gov source recorded");
  if (!sources.includes("https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB1394")) fail("SB 1394 source missing");
  else ok("SB 1394 source recorded");
  if (!String(courtHolidays.notes[1] || "").includes("Eid al-Fitr, Eid al-Adha, and Sylvia Mendez Day")) fail("2027 CCP 135 exclusions missing from notes");
  else ok("2027 CCP 135 exclusions noted in dataset");
}

function scanBuiltPii() {
  const dir = join(root, ".next");
  if (!existsSync(dir)) { ok("built PII scan skipped (no .next yet)"); return; }
  const serverDir = join(dir, "server");
  const targets = [];
  if (existsSync(serverDir)) {
    walk(serverDir).forEach(p => {
      if (p.includes("ca-court-holidays") && (p.endsWith(".html") || p.endsWith(".rsc") || p.endsWith(".js") || p.endsWith(".body"))) targets.push(p);
    });
  }
  const html = join(dir, "server/app/tools/ca-court-holidays.html");
  if (existsSync(html)) targets.push(html);
  const unique = [...new Set(targets)];
  if (!unique.length) { fail("built PII scan: no ca-court-holidays output in .next"); return; }
  let blob = "";
  for (const f of unique) blob += "\n" + readFileSync(f, "utf8");
  scanPii("built ca-court-holidays", blob, { allowExisting: true });
  if (!blob.includes(DISCLAIMER)) fail("built output missing disclaimer");
  else ok("built output includes disclaimer");
  let built = blob;
  if (!/Get a weekly plain-English AI tip|Join the list/.test(built)) {
    walk(dir).forEach(p => {
      if (/\.(js|rsc|html)$/.test(p) && statSync(p).size < 2_000_000) {
        const t = readFileSync(p, "utf8");
        if (t.includes("Get a weekly plain-English AI tip") || t.includes("ca-court-holidays")) built += "\n" + t;
      }
    });
  }
  if (!/Get a weekly plain-English AI tip|Join the list/.test(built)) fail("built output missing CTA");
  else ok("built output includes CTA");
}

if (lintOnly || typecheckOnly) {
  syntaxCheck();
} else {
  unitAffiliate();
  contentChecks();
  unitCourtHolidays();
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
  scanBuiltPii();
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
