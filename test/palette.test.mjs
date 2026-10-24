import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AA_TEXT, AA_UI, contrastRatio } from "../lib/contrast.mjs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const site = JSON.parse(readFileSync(new URL("../content/site.json", import.meta.url), "utf8"));
const PRIMARY = "#1F6F50";
const HIGHLIGHT = "#D9622B";
const INK = "#1a1a1a";
const WHITE = "#ffffff";
const CREAM = "#fafaf7";

test("primary is Main Street Green and drives the existing accent token", () => {
  assert.equal(site.color, PRIMARY);
  assert.match(css, new RegExp(`--color-primary:${PRIMARY}`));
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  assert.match(layout, /"--accent":\s*site\.color/);
  assert.match(layout, /"--color-primary":\s*site\.color/);
});

test("highlight token is a single Awning Orange line", () => {
  assert.equal(css.match(/#D9622B/g)?.length, 1);
  assert.doesNotMatch(css, /#B5432C/i);
  assert.match(css, /--color-highlight:#D9622B;/);
  assert.doesNotMatch(css, /(?:^|[^-])color:\s*var\(--color-highlight\)/);
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /#D9622B/i);
});

test("text on Awning Orange uses dark ink because white fails AA", () => {
  assert.ok(contrastRatio(WHITE, HIGHLIGHT) < AA_TEXT);
  assert.ok(contrastRatio(INK, HIGHLIGHT) >= AA_TEXT);
  assert.match(css, /::selection\{background:var\(--color-highlight\);color:#1a1a1a\}/);
  assert.match(css, /::-moz-selection\{background:var\(--color-highlight\);color:#1a1a1a\}/);
});

test("primary and banner colors meet WCAG AA", () => {
  assert.ok(contrastRatio(PRIMARY, WHITE) >= AA_TEXT);
  assert.ok(contrastRatio(WHITE, PRIMARY) >= AA_TEXT);
  assert.ok(contrastRatio(PRIMARY, CREAM) >= AA_TEXT);
  assert.ok(contrastRatio(INK, WHITE) >= AA_TEXT);
  assert.ok(contrastRatio(HIGHLIGHT, WHITE) >= AA_UI);
  assert.ok(contrastRatio(HIGHLIGHT, CREAM) >= AA_UI);
  assert.ok(contrastRatio(HIGHLIGHT, PRIMARY) < AA_UI);
});
