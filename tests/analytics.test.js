import assert from "node:assert/strict";
import { test } from "node:test";
import { ctaParams, gaBootstrap, normalizeGaId, sendEvent } from "../app/analytics.js";

test("GA id is empty unless it is a GA4 measurement id", () => {
  assert.equal(normalizeGaId(""), "");
  assert.equal(normalizeGaId(undefined), "");
  assert.equal(normalizeGaId("UA-12345-1"), "");
  assert.equal(normalizeGaId("GTM-ABC"), "");
  assert.equal(normalizeGaId("G-ABC</script>"), "");
  assert.equal(normalizeGaId(" G-AbC123 "), "G-AbC123");
  assert.equal(gaBootstrap(""), null);
  assert.equal(gaBootstrap("not-an-id"), null);
});

test("bootstrap strips query strings and does not load without an id", () => {
  const tag = gaBootstrap("G-TEST1234");
  assert.ok(tag);
  assert.equal(tag.src, "https://www.googletagmanager.com/gtag/js?id=G-TEST1234");
  assert.match(tag.inline, /page_location: window\.location\.origin \+ window\.location\.pathname/);
  assert.doesNotMatch(tag.inline, /search|email|phone/);
  assert.match(tag.inline, /gtag\('config', "G-TEST1234"/);
});

test("generate_lead sends no parameters", () => {
  const calls = [];
  assert.equal(sendEvent((...args) => calls.push(args), "G-TEST", "generate_lead", { email: "a@b.com", phone: "9495551212", message: "hi" }), true);
  assert.deepEqual(calls, [["event", "generate_lead"]]);
  assert.equal(sendEvent((...args) => calls.push(args), "", "generate_lead"), false);
  assert.equal(calls.length, 1);
});

test("cta_click keeps only label and location and drops contact-shaped values", () => {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  assert.equal(sendEvent(gtag, "G-TEST", "cta_click", { cta_label: "Get it built for me", cta_location: "page_cta", email: "a@b.com" }), true);
  assert.deepEqual(calls[0], ["event", "cta_click", { cta_label: "Get it built for me", cta_location: "page_cta" }]);
  assert.equal(sendEvent(gtag, "G-TEST", "cta_click", { cta_label: "you@example.com", cta_location: "hero" }), false);
  assert.equal(sendEvent(gtag, "G-TEST", "cta_click", { cta_label: "Call (949) 555-1234", cta_location: "hero" }), false);
  assert.equal(sendEvent(gtag, "G-TEST", "purchase", { value: 10 }), false);
  assert.equal(calls.length, 1);
  assert.equal(ctaParams("", "hero"), null);
});
