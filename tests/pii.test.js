import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g;
const SERVER_ONLY = new Set([
  "app/ads-lib.js",
  "app/api/build-request/route.js",
]);
const EMAIL_OK = new Set(["you@example.com"]);
const PHONE_OK = new Set(["(949) 555-1234"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|mjs|jsx|json|md|css)$/.test(name)) out.push(full);
  }
  return out;
}

function sources() {
  return [...walk(path.join(root, "app")), ...walk(path.join(root, "content")), path.join(root, "README.md")];
}

test("rendered sources do not add contact emails, phones, or payment identifiers", () => {
  const hits = [];
  for (const full of sources()) {
    const rel = path.relative(root, full).split(path.sep).join("/");
    if (rel.startsWith("tests/")) continue;
    const text = readFileSync(full, "utf8");
    if (/mailto:|tel:/i.test(text)) hits.push(`${rel} has a mailto or tel link`);
    const emails = text.match(EMAIL) || [];
    const phones = text.match(PHONE) || [];
    if (SERVER_ONLY.has(rel)) continue;
    for (const email of emails) if (!EMAIL_OK.has(email.toLowerCase())) hits.push(`${rel} email ${email}`);
    for (const phone of phones) if (!PHONE_OK.has(phone)) hits.push(`${rel} phone ${phone}`);
    if (rel.startsWith("app/") && rel.endsWith(".js") && /["']use client["']/.test(text)) {
      if (/ads-lib|vincent@|ads@agentsformainstreet|requests@agentsformainstreet/.test(text)) hits.push(`${rel} imports a server mailbox`);
    }
  }
  assert.deepEqual(hits, []);
});

test("lead events are called with no form fields", () => {
  for (const rel of ["app/BuildRequestForm.js", "app/AdOrderForm.js", "app/NewsletterForm.js"]) {
    const text = readFileSync(path.join(root, rel), "utf8");
    assert.match(text, /trackGenerateLead\(\)/);
    assert.equal(text.replaceAll("trackGenerateLead()", "").includes("trackGenerateLead("), false);
  }
  const tracker = readFileSync(path.join(root, "app/CtaTracker.js"), "utf8");
  assert.match(tracker, /data-cta-label/);
  assert.match(tracker, /data-cta-location/);
  assert.doesNotMatch(tracker, /email|phone|message/i);
});
