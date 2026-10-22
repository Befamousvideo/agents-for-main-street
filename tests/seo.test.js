import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { adPolicyDescription, advertiseDescription, buildLlmsTxt, buildRobots, buildSitemap, faqLd, jsonLd, metaDesc, organizationGraph, pageMeta } from "../app/seo.js";

const site = JSON.parse(readFileSync(new URL("../content/site.json", import.meta.url), "utf8"));

test("sitemap and robots use the production domain", () => {
  const entries = buildSitemap({
    domain: site.domain,
    updated: "2026-10-22",
    pages: [
      { path: "/about", lastModified: "2026-10-22" },
      { path: "/advertise/thanks", lastModified: "2026-10-22" },
      { path: "/api/n/order", lastModified: "2026-10-22" },
    ],
  });
  const urls = entries.map((e) => e.url);
  assert.ok(urls.includes(`https://${site.domain}`));
  assert.ok(urls.includes(`https://${site.domain}/about`));
  assert.ok(urls.includes(`https://${site.domain}/advertise`));
  assert.ok(urls.includes(`https://${site.domain}/advertise/policy`));
  assert.equal(urls.some((u) => u.includes("thanks") || u.includes("/api")), false);
  assert.ok(urls.every((u) => u === `https://${site.domain}` || u.startsWith(`https://${site.domain}/`)));
  assert.equal(urls.filter((u) => u === `https://${site.domain}`).length, 1);

  const robots = buildRobots(site.domain);
  assert.equal(robots.sitemap, `https://${site.domain}/sitemap.xml`);
  assert.equal(robots.host, `https://${site.domain}`);
  assert.deepEqual(robots.rules.disallow, ["/advertise/thanks", "/api/"]);
});

test("json-ld is organization plus website, and faq only for real questions", () => {
  const graph = organizationGraph({ name: site.name, domain: site.domain, description: site.description, parentName: "StorenTech" });
  assert.deepEqual(graph["@graph"].map((n) => n["@type"]), ["Organization", "WebSite"]);
  const keys = [];
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    for (const [k, val] of Object.entries(v)) {
      if (/email|telephone|phone|fax|contactPoint/i.test(k)) keys.push(k);
      walk(val);
    }
  };
  walk(graph);
  assert.deepEqual(keys, []);
  assert.equal(faqLd(undefined), null);
  assert.equal(faqLd([]), null);
  assert.equal(faqLd([{ q: "Only a question" }]), null);
  const faq = faqLd(site.home.faq);
  assert.equal(faq["@type"], "FAQPage");
  assert.equal(faq.mainEntity.length, site.home.faq.length);
  assert.equal(jsonLd({ t: "</script><script>" }).includes("</script>"), false);
});

test("every page meta has canonical, description, open graph, and twitter", () => {
  const meta = pageMeta({ title: "Advertise", description: advertiseDescription(site.name), path: "/advertise", siteName: site.name });
  assert.equal(meta.title, "Advertise");
  assert.equal(meta.description, advertiseDescription(site.name));
  assert.equal(meta.alternates.canonical, "/advertise");
  assert.equal(meta.openGraph.url, "/advertise");
  assert.equal(meta.openGraph.title, `Advertise | ${site.name}`);
  assert.equal(meta.openGraph.description, meta.description);
  assert.equal(meta.twitter.card, "summary");
  assert.equal(meta.twitter.title, meta.openGraph.title);
  assert.equal(meta.twitter.description, meta.description);
  const hidden = pageMeta({ title: "Thanks for your order", description: "Thank you. We're confirming your payment.", path: "/advertise/thanks", siteName: site.name, index: false });
  assert.deepEqual(hidden.robots, { index: false, follow: false });
  assert.equal(hidden.alternates.canonical, "/advertise/thanks");
});

test("llms.txt repeats existing copy and does not add contact details", () => {
  const text = buildLlmsTxt({ site, groups: [] });
  assert.ok(text.startsWith(`# ${site.name}\n\n> ${site.description}\n`));
  for (const p of site.pages) assert.ok(text.includes(p.summary), p.path);
  for (const p of site.static) assert.ok(text.includes(p.title), p.path);
  assert.ok(text.includes(advertiseDescription(site.name)));
  assert.ok(text.includes(adPolicyDescription(site.name)));
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text), false);
  assert.equal(/\b\d{3}[-.\s)]+\d{3}[-.\s]+\d{4}\b/.test(text), false);
  const long = "word ".repeat(50).trim();
  const trimmed = metaDesc(long);
  assert.ok(trimmed.length <= 160);
  assert.ok(trimmed.endsWith("…"));
});
