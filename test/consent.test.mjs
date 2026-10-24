import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  ANALYTICS_DENIED_UPDATE,
  ANALYTICS_GRANTED_UPDATE,
  CONSENT_DEFAULT_DENIED,
  CONSENT_MAX_AGE,
  GA_FALLBACK_ID,
  consentBootSource,
  consentCookie,
  parseConsentCookie,
  readChoice,
  resolveGaId,
} from "../lib/consent.mjs";

const PII = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:\+?1[-.\s]*)?\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4}\b|\b(?:stripe|card number|cvv)\b/i;

function bootEnv({ cookie = "", stored = null, foreign = false } = {}) {
  const scripts = [];
  const attrs = {};
  const state = { cookie, stored };
  const document = {
    get cookie() { return state.cookie; },
    set cookie(v) { state.cookie = v; },
    documentElement: { setAttribute(name, value) { attrs[name] = value; } },
    querySelector() { return foreign ? { src: "https://www.googletagmanager.com/gtag/js?id=G-OTHER0000" } : null; },
    getElementById(id) { return scripts.find((s) => s.id === id) || null; },
    createElement() { return { id: "", async: false, src: "" }; },
    head: { appendChild(node) { scripts.push(node); return node; } },
  };
  const context = {
    document,
    localStorage: { getItem() { return state.stored; } },
  };
  context.window = context;
  vm.createContext(context);
  return {
    context,
    scripts,
    attrs,
    state,
    run(envValue) { vm.runInContext(consentBootSource(envValue), context); },
    calls() { return (context.dataLayer || []).map((args) => JSON.parse(JSON.stringify(Array.from(args)))); },
  };
}

test("measurement id comes from NEXT_PUBLIC_GA_ID and falls back to the public id", () => {
  assert.equal(GA_FALLBACK_ID, "G-ECB8CXZGD7");
  assert.equal(resolveGaId(undefined), GA_FALLBACK_ID);
  assert.equal(resolveGaId(""), GA_FALLBACK_ID);
  assert.equal(resolveGaId("  G-CUSTOM123 "), "G-CUSTOM123");
  assert.equal(resolveGaId("user@example.com"), GA_FALLBACK_ID);
  assert.equal(resolveGaId("G-ECB8CXZGD7;alert(1)"), GA_FALLBACK_ID);
  const src = consentBootSource("not a measurement id");
  assert.match(src, new RegExp(GA_FALLBACK_ID));
  assert.doesNotMatch(src, /not a measurement id|example\.com|alert\(1\)|@/);
});

test("choice storage is accepted or rejected and is not PII", () => {
  assert.equal(consentCookie("accepted"), `ams_consent=accepted; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax`);
  assert.match(consentCookie("rejected", { secure: true }), /^ams_consent=rejected;.*Secure$/);
  assert.throws(() => consentCookie("user@example.com"));
  assert.equal(parseConsentCookie("ams_consent=user@example.com"), null);
  assert.equal(parseConsentCookie("foo=1; ams_consent=rejected"), "rejected");
  const storage = { getItem: () => "accepted" };
  assert.equal(readChoice(storage, "ams_consent=rejected"), "accepted");
  assert.equal(readChoice({ getItem: () => "555-0100" }, "ams_consent=rejected"), "rejected");
  assert.equal(readChoice(null, ""), null);
});

test("gtag is not requested before a choice or after reject", () => {
  const none = bootEnv();
  none.run();
  assert.equal(none.scripts.length, 0);
  assert.equal(none.context.dataLayer, undefined);
  assert.equal(none.attrs["data-consent"], undefined);

  const rejected = bootEnv({ stored: "rejected" });
  rejected.run();
  assert.equal(rejected.scripts.length, 0);
  assert.equal(rejected.context.dataLayer, undefined);
  assert.equal(rejected.attrs["data-consent"], "rejected");
});

test("an existing Google tag gets Consent Mode v2 denied without loading ours", () => {
  const foreign = bootEnv({ foreign: true });
  foreign.run();
  assert.equal(foreign.scripts.length, 0);
  const calls = foreign.calls();
  assert.deepEqual(calls[0], ["consent", "default", CONSENT_DEFAULT_DENIED]);
  assert.equal(calls.some((c) => c[0] === "config"), false);

  const rejected = bootEnv({ foreign: true, cookie: "ams_consent=rejected" });
  rejected.run();
  assert.equal(rejected.scripts.length, 0);
  const denied = rejected.calls().find((c) => c[0] === "consent" && c[1] === "update");
  assert.deepEqual(denied[2], ANALYTICS_DENIED_UPDATE);
});

test("accept loads gtag once and grants analytics only", () => {
  const env = bootEnv({ cookie: "ams_consent=accepted" });
  env.run("G-CUSTOM123");
  env.run("G-CUSTOM123");
  assert.equal(env.scripts.length, 1);
  assert.equal(env.scripts[0].id, "ga4-loader");
  assert.equal(env.scripts[0].async, true);
  assert.equal(env.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-CUSTOM123");
  const calls = env.calls();
  assert.deepEqual(calls[0], ["consent", "default", CONSENT_DEFAULT_DENIED]);
  assert.deepEqual(calls[1], ["set", "ads_data_redaction", true]);
  assert.deepEqual(calls[2], ["consent", "update", ANALYTICS_GRANTED_UPDATE]);
  assert.equal(calls[3][0], "js");
  assert.equal(calls[4][0], "config");
  assert.equal(calls[4][1], "G-CUSTOM123");
  assert.equal(calls[4][2].anonymize_ip, true);
  assert.equal(calls.filter((c) => c[0] === "config").length, 1);
});

test("a choice made after load is what requests gtag", () => {
  const env = bootEnv();
  env.run();
  assert.equal(env.scripts.length, 0);
  env.state.stored = "accepted";
  env.state.cookie = "ams_consent=accepted";
  env.run();
  assert.equal(env.scripts.length, 1);
  assert.match(env.scripts[0].src, new RegExp(GA_FALLBACK_ID));
});

test("banner, boot, and layout do not put phone, email, or payment PII in the DOM", () => {
  for (const rel of ["../lib/consent.mjs", "../app/CookieConsent.js", "../app/layout.js", "../app/globals.css"]) {
    const text = readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(text, PII, rel);
  }
  const banner = readFileSync(new URL("../app/CookieConsent.js", import.meta.url), "utf8");
  assert.equal(banner.match(/className="btn consent-btn"/g)?.length, 2);
  assert.doesNotMatch(banner, /ghost|btn-primary|consent-btn--accept/);
  assert.match(banner, /href="\/privacy"/);
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  assert.match(layout, /consentBootSource\(process\.env\.NEXT_PUBLIC_GA_ID\)/);
  assert.doesNotMatch(layout, /googletagmanager\.com/);
  const privacy = JSON.parse(readFileSync(new URL("../content/site.json", import.meta.url), "utf8")).static.find((p) => p.path === "/privacy");
  assert.ok(privacy.blocks[0].ul.some((line) => /first-party cookie/i.test(line) && /accept/i.test(line)));
});
