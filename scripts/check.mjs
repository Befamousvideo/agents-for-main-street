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
  AFFILIATE_REL,
  isAffiliateUrl,
  isToolCard,
  externalRel,
  tokenizeLinks,
  renderInlineHtml,
  renderToolCardHtml,
  textContainers,
  schemaText,
  schemaJson,
  jsonLdScripts,
  findAffiliateAnchors
} = require("../app/affiliates.js");
const site = require("../content/site.json");

const argv = process.argv.slice(2);
const args = new Set(argv);
const lintOnly = args.has("--lint");
const typecheckOnly = args.has("--typecheck");
const builtIdx = argv.indexOf("--built");
const builtBase = builtIdx >= 0 ? argv[builtIdx + 1] : null;
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

function assertAnchor(html, label) {
  const anchors = findAffiliateAnchors(html);
  if (!anchors.length) { fail(`${label} missing affiliate <a>`); return []; }
  for (const a of anchors) {
    if (a.rel !== AFFILIATE_REL) fail(`${label} rel="${a.rel}" expected "${AFFILIATE_REL}"`);
    else ok(`${label} rel is ${AFFILIATE_REL}`);
    if (a.target !== "_blank") fail(`${label} target="${a.target}" expected "_blank"`);
    else ok(`${label} target is _blank`);
    if (!a.pHtml) fail(`${label} affiliate link is not inside a <p>`);
    else ok(`${label} affiliate link is inside a <p>`);
    if (a.discIdx < 0) fail(`${label} disclosure missing from the same <p> as the link`);
    else ok(`${label} disclosure is in the same <p> as the link`);
    if (/<small/i.test(a.nearby) || /aff-disclosure/i.test(a.nearby)) fail(`${label} aff-disclosure or <small near affiliate link`);
    else ok(`${label} no aff-disclosure or <small near affiliate link`);
    if (/\bmuted\b/.test(a.pAttrs) || /\bsmall\b/.test(a.pAttrs)) fail(`${label} disclosure <p> uses muted/small class`);
    else ok(`${label} disclosure is body text, not muted/small`);
  }
  if (/\(affiliate link\)/i.test(html)) fail(`${label} uses forbidden '(affiliate link)' parenthetical`);
  else ok(`${label} does not use '(affiliate link)'`);
  return anchors;
}

function unitAffiliate() {
  if (!isAffiliateUrl(HIGGSFIELD_AFFILIATE_URL)) fail("affiliate URL should be detected");
  else ok("affiliate URL detected");
  if (isAffiliateUrl("https://higgsfield.ai/")) fail("citation URL must not be marked affiliate");
  else ok("citation URL is not affiliate");
  if (externalRel(HIGGSFIELD_AFFILIATE_URL) !== AFFILIATE_REL) fail("affiliate rel");
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
  const inner = tokenizeLinks("See [Make a 15-second AI video ad](/industries/local-business/make-15-second-ai-video-ad).");
  if (!inner.some(t => t.type === "link" && t.href === "/industries/local-business/make-15-second-ai-video-ad")) fail("internal markdown tokenize");
  else ok("internal markdown link tokenized");
  const htmlAfter = `<p>${renderInlineHtml(`Open [Higgsfield](${HIGGSFIELD_AFFILIATE_URL}). ${AFFILIATE_DISCLOSURE}`)}</p>`;
  assertAnchor(htmlAfter, "inline render after link");
  const htmlBefore = `<p>${renderInlineHtml(`${AFFILIATE_DISCLOSURE} like [Higgsfield](${HIGGSFIELD_AFFILIATE_URL}).`)}</p>`;
  assertAnchor(htmlBefore, "inline render before link");
  const cardHtml = renderToolCardHtml({
    h: "Higgsfield",
    p: "An AI platform for making images and short videos.",
    cta: "Try Higgsfield →",
    href: HIGGSFIELD_AFFILIATE_URL,
    disclosure: AFFILIATE_DISCLOSURE
  });
  if (!cardHtml.includes('class="card tool-card"') || !cardHtml.includes("<h3>Higgsfield</h3>")) fail("tool card markup");
  else ok("tool card markup");
  if (!cardHtml.includes(`<p><a href="${HIGGSFIELD_AFFILIATE_URL}"`) || !cardHtml.includes(`</a> ${AFFILIATE_DISCLOSURE}</p>`)) fail("tool card same-paragraph disclosure");
  else ok("tool card same-paragraph disclosure");
  assertAnchor(cardHtml, "tool card render");
  const nearSmall = findAffiliateAnchors(`<p><a href="${HIGGSFIELD_AFFILIATE_URL}" rel="${AFFILIATE_REL}" target="_blank">Higgsfield</a> ${AFFILIATE_DISCLOSURE}</p><small class="aff-disclosure">x</small>`);
  if (!nearSmall.length) fail("nearby-small fixture missing affiliate link");
  else if (!(/<small/i.test(nearSmall[0].nearby) || /aff-disclosure/i.test(nearSmall[0].nearby))) fail("nearby window missed aff-disclosure or <small");
  else ok("test fails if aff-disclosure or <small appears near any affiliate link");
  if (schemaText(STEP_3) !== STEP_3_SCHEMA) fail("schemaText step 3 " + JSON.stringify(schemaText(STEP_3)));
  else ok("schemaText strips disclosure and affiliate URL from step 3");
  const dirtyLd = schemaJson({ text: STEP_3, url: HIGGSFIELD_AFFILIATE_URL });
  const dirtyJson = JSON.stringify(dirtyLd);
  if (/Affiliate link/i.test(dirtyJson) || /fpr=/i.test(dirtyJson)) fail("schemaJson left Affiliate link or fpr=");
  else ok("schemaJson strips Affiliate link and fpr=");
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

const PLACEMENT_A = "/industries/local-business/make-15-second-ai-video-ad";
const PLACEMENT_B = "/tips/tiktok-must-eat-restaurant-guide";
const PLACEMENT_C = "/industries/local-business/google-business-profile-holiday-posts";
const TOOLS_LINE = "Tools: an AI video generation platform, a one-sentence offer, and photos you own.";
const COSTS_LINE = "Costs: see each vendor's current pricing page; we don't list prices we haven't verified.";
const CARD_BODY = "An AI platform for making images and short videos. Start from a written prompt or an image you upload, and use templates built for short social clips and product ads. Good fit for this recipe: paste your one-sentence offer, add a product or storefront photo you own, and generate a short clip to review.";
const STEP_3 = `Open an AI video generation platform such as [Higgsfield](${HIGGSFIELD_AFFILIATE_URL}). ${AFFILIATE_DISCLOSURE} Paste your sentence, attach a photo if the tool accepts one, set length to about 15 seconds if asked, and generate the clip.`;
const STEP_3_SCHEMA = "Open an AI video generation platform such as Higgsfield. Paste your sentence, attach a photo if the tool accepts one, set length to about 15 seconds if asked, and generate the clip.";
const STEP_3_HTML = `<p>Open an AI video generation platform such as <a href="${HIGGSFIELD_AFFILIATE_URL}" rel="${AFFILIATE_REL}" target="_blank">Higgsfield</a>. ${AFFILIATE_DISCLOSURE} Paste your sentence, attach a photo if the tool accepts one, set length to about 15 seconds if asked, and generate the clip.</p>`;
const LINE_B = `No time to film? You can turn a dish photo you own into a short clip with an AI video tool like [Higgsfield](${HIGGSFIELD_AFFILIATE_URL}). Watch it all the way through before you post, and make sure it shows real food from your menu. ${AFFILIATE_DISCLOSURE} For the full steps, see [Make a 15-second AI video ad](/industries/local-business/make-15-second-ai-video-ad).`;
const LINE_C = `Want a short video for your update post? Our [15-second AI video ad recipe](/industries/local-business/make-15-second-ai-video-ad) shows how to make one with a tool like [Higgsfield](${HIGGSFIELD_AFFILIATE_URL}). ${AFFILIATE_DISCLOSURE}`;
const PROMO_RE = /\b(coupon|discount|% off|promo code|free trial|free plan)\b/i;

function parseJsonLd(html) {
  const out = [];
  for (const block of jsonLdScripts(html)) {
    const value = JSON.parse(block);
    out.push(...(Array.isArray(value) ? value : [value]));
  }
  return out;
}

function assertJsonLdClean(html, label) {
  const scripts = jsonLdScripts(html);
  if (!scripts.length) { fail(`${label} missing JSON-LD`); return []; }
  for (const block of scripts) {
    if (/Affiliate link/i.test(block) || /fpr=/i.test(block)) fail(`${label} JSON-LD contains Affiliate link or fpr=`);
    else ok(`${label} JSON-LD has no Affiliate link or fpr=`);
  }
  return parseJsonLd(html);
}

function contentChecks() {
  const recipe = site.pages.find(p => p.path === PLACEMENT_A);
  const tip = site.pages.find(p => p.path === PLACEMENT_B);
  const gbp = site.pages.find(p => p.path === PLACEMENT_C);
  if (!recipe) { fail("recipe page missing"); return; }
  ok("recipe page exists");
  if (recipe.title !== "Make a 15-second AI video ad") fail("recipe title");
  else ok("recipe title");
  if (recipe.group !== "recipes" || !recipe.steps?.length) fail("recipe format");
  else ok("recipe has steps");
  if (recipe.steps[2] !== STEP_3) fail("recipe step 3 wording");
  else ok("recipe step 3 has Tony's affiliate copy");
  if (schemaText(recipe.steps[2]) !== STEP_3_SCHEMA) fail("recipe HowTo step 3 schema text");
  else ok("recipe HowTo step 3 schema text omits disclosure");
  if (renderInlineHtml(STEP_3) !== STEP_3_HTML.replace(/^<p>/, "").replace(/<\/p>$/, "")) fail("recipe step 3 HTML");
  else ok("recipe step 3 renders Tony's HTML");
  if (/\(affiliate link\)/i.test(JSON.stringify(recipe))) fail("recipe uses '(affiliate link)'");
  else ok("recipe does not use '(affiliate link)'");

  const need = (recipe.blocks || []).find(b => b.h === "What you need");
  if (!need) { fail("What you need missing"); return; }
  if (need.p?.[0] !== TOOLS_LINE) fail("Tools line wording");
  else ok("Tools line wording");
  const card = need.p?.[1];
  if (!isToolCard(card) || card.h !== "Higgsfield" || card.p !== CARD_BODY || card.cta !== "Try Higgsfield →" || card.href !== HIGGSFIELD_AFFILIATE_URL || card.disclosure !== AFFILIATE_DISCLOSURE) {
    fail("Higgsfield tool card copy");
  } else ok("Higgsfield tool card copy");
  if (need.p?.[2] !== COSTS_LINE) fail("Costs line wording");
  else ok("Costs line kept as is");
  const standalone = (need.p || []).filter(t => typeof t === "string" && t.includes("commission"));
  if (standalone.length) fail("standalone commission paragraph still in What you need");
  else ok("no standalone commission paragraph in What you need");
  const sources = (recipe.blocks || []).find(b => b.h === "Sources");
  if (!sources?.p?.some(t => String(t).includes("https://higgsfield.ai/") && !String(t).includes("fpr="))) fail("Sources citation URL");
  else ok("Sources keeps plain higgsfield.ai citation");

  if (!tip) fail("tiktok tip page missing");
  else {
    const doit = (tip.blocks || []).find(b => /^Do this/.test(b.h || ""));
    const ol = doit?.ol || [];
    const idx = ol.indexOf("Tag your restaurant's location on every video you post, and ask staff who post about work to do the same.");
    if (idx < 0 || ol[idx + 1] !== LINE_B) fail("placement B line after step 2");
    else ok("placement B line after step 2");
  }

  if (!gbp) fail("GBP holiday posts page missing");
  else {
    const confirmed = (gbp.blocks || []).find(b => b.h === "What's confirmed (Google Business Profile Help)");
    const ul = confirmed?.ul || [];
    const idx = ul.indexOf("Update posts can include a description, photo or video and an action button with a link.");
    if (idx < 0 || ul[idx + 1] !== LINE_C) fail("placement C line after update-posts sentence");
    else ok("placement C line after update-posts sentence");
  }

  const pages = [...site.pages, ...site.static];
  let affPages = 0;
  for (const p of pages) {
    const blobs = textContainers(p);
    const hits = blobs.filter(t => t.includes(HIGGSFIELD_AFFILIATE_URL));
    if (!hits.length) continue;
    affPages++;
    for (const blob of hits) {
      if (!blob.includes(AFFILIATE_DISCLOSURE)) fail(`${p.path} affiliate URL without same-container disclosure`);
      else ok(`${p.path} disclosure in same container as affiliate URL`);
      if (blob.includes("Try Higgsfield →") && p.path === PLACEMENT_A) assertAnchor(renderToolCardHtml(need.p[1]), `${p.path} card`);
      else assertAnchor(`<p>${renderInlineHtml(blob)}</p>`, p.path);
      if (PROMO_RE.test(blob)) fail(`${p.path} Higgsfield copy has coupon/discount/free-plan wording`);
      else ok(`${p.path} Higgsfield copy has no coupon/discount/free-plan wording`);
    }
    scanPii(p.path, JSON.stringify(p), { allowExisting: false });
  }
  if (affPages !== 3) fail(`expected affiliate links on 3 pages, found ${affPages}`);
  else ok("affiliate links only on the three intended pages");

  if (JSON.stringify(site.home).includes(HIGGSFIELD_AFFILIATE_URL)) fail("homepage copy has affiliate URL");
  else ok("homepage has no affiliate URL");
  const cardCopy = pages.filter(p => p.group === "recipes" || p.group === "tips").map(p => `${p.title}\n${p.summary}\n${p.label || ""}`).join("\n");
  if (cardCopy.includes(HIGGSFIELD_AFFILIATE_URL) || cardCopy.includes("fpr=vincent")) fail("title/summary cards have affiliate URL");
  else ok("homepage and /industries cards have no affiliate URL");
  if (/\(affiliate link\)/i.test(JSON.stringify(site))) fail("site copy uses '(affiliate link)'");
  else ok("site copy does not use '(affiliate link)'");
}

async function builtChecks(base) {
  const paths = ["/", "/industries", "/industries/local-business", PLACEMENT_A, PLACEMENT_B, PLACEMENT_C];
  const expected = {
    "/": 0,
    "/industries": 0,
    "/industries/local-business": 0,
    [PLACEMENT_A]: 2,
    [PLACEMENT_B]: 1,
    [PLACEMENT_C]: 1
  };
  for (const path of paths) {
    const url = base.replace(/\/$/, "") + path;
    let html;
    try {
      const res = await fetch(url);
      if (!res.ok) { fail(`GET ${path} status ${res.status}`); continue; }
      html = await res.text();
    } catch (e) {
      fail(`GET ${path} ${e.message}`);
      continue;
    }
    const anchors = findAffiliateAnchors(html);
    const n = expected[path];
    if (anchors.length !== n) fail(`${path} affiliate count ${anchors.length}, expected ${n}`);
    else ok(`${path} affiliate count ${anchors.length}`);
    if (n) assertAnchor(html, `built ${path}`);
    else if (/\(affiliate link\)/i.test(html) || /aff-disclosure/i.test(html)) fail(`${path} has forbidden affiliate markup`);
    else ok(`${path} has no affiliate markup`);
    const nodes = assertJsonLdClean(html, `built ${path}`);
    if (path === PLACEMENT_A) {
      if (!html.includes('class="card tool-card"') || !html.includes("Try Higgsfield")) fail("built recipe missing tool card");
      else ok("built recipe has Higgsfield tool card");
      if (!html.includes(STEP_3_HTML)) fail("built recipe step 3 is not Tony's HTML");
      else ok("built recipe step 3 is Tony's HTML");
      const howto = nodes.find(n => n["@type"] === "HowTo");
      const step3 = howto?.step?.[2]?.text;
      if (step3 !== STEP_3_SCHEMA) fail(`built recipe HowTo step 3 is ${JSON.stringify(step3)}`);
      else ok("built recipe HowTo step 3 omits disclosure");
      const citation = html.match(/https:\/\/higgsfield\.ai\/(?![^\s"'<]*fpr)/);
      if (!citation) fail("built recipe missing non-affiliate Sources citation");
      else ok("built recipe keeps non-affiliate Sources citation");
      const commissionPs = [...html.matchAll(/<p\b[^>]*>[\s\S]*?commission[\s\S]*?<\/p>/gi)];
      const lone = commissionPs.filter(m => !/higgsfield\.ai\?fpr=/i.test(m[0]));
      if (lone.length) fail("built recipe has a standalone commission paragraph");
      else ok("built recipe has no standalone commission paragraph");
    }
    scanPii(`built ${path}`, html, { allowExisting: false });
  }
}

if (lintOnly || typecheckOnly) {
  syntaxCheck();
} else if (builtBase) {
  await builtChecks(builtBase);
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
