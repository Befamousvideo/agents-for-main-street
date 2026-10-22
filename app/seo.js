// @ts-check

/** @param {string} name */
export const advertiseDescription = (name) => `Advertise on ${name}: labeled, reviewed ads with simple founding pricing.`;
/** @param {string} name */
export const adPolicyDescription = (name) => `What ${name} will and won't advertise.`;

/** @param {string | undefined | null} s */
export function metaDesc(s) {
  if (!s || s.length <= 160) return s;
  const c = s.slice(0, 157);
  const i = c.lastIndexOf(" ");
  return (i > 0 ? c.slice(0, i) : c).replace(/[,;:\u2014\u2013-]+$/, "") + "\u2026";
}

/**
 * @param {{ title: string, description: string, path: string, siteName: string, type?: string, index?: boolean, absoluteTitle?: boolean }} opts
 */
export function pageMeta(opts) {
  const { title, description, path, siteName, type = "website", index = true, absoluteTitle = false } = opts;
  const socialTitle = absoluteTitle || title.includes(siteName) ? title : `${title} | ${siteName}`;
  /** @type {Record<string, unknown>} */
  const meta = {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title: socialTitle, description, type, url: path, siteName },
    twitter: { card: "summary", title: socialTitle, description },
  };
  if (!index) meta.robots = { index: false, follow: false };
  return meta;
}

/** @param {unknown} data */
export function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * @param {{ name: string, domain: string, description: string, parentName: string }} site
 */
export function organizationGraph(site) {
  const url = `https://${site.domain}`;
  const orgId = `${url}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: site.name,
        url,
        description: site.description,
        parentOrganization: { "@type": "Organization", name: site.parentName },
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: site.name,
        url,
        description: site.description,
        publisher: { "@id": orgId },
      },
    ],
  };
}

/** @param {{ q?: string, a?: string }[] | undefined | null} faq */
export function faqLd(faq) {
  if (!Array.isArray(faq) || !faq.length) return null;
  const mainEntity = [];
  for (const f of faq) {
    if (!f || !f.q || !f.a) continue;
    mainEntity.push({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } });
  }
  if (!mainEntity.length) return null;
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
}

/**
 * @param {{ domain: string, updated?: string, pages: { path: string, lastModified?: string }[] }} input
 */
export function buildSitemap({ domain, updated, pages }) {
  const base = `https://${domain}`;
  /** @type {Map<string, { url: string, lastModified?: string }>} */
  const map = new Map();
  /** @param {string | undefined} path @param {string | undefined} lastModified */
  const add = (path, lastModified) => {
    if (!path || path === "/advertise/thanks" || path.startsWith("/api")) return;
    const url = path === "/" ? base : `${base}${path.startsWith("/") ? path : `/${path}`}`;
    if (!(url === base || url.startsWith(`${base}/`)) || map.has(url)) return;
    /** @type {{ url: string, lastModified?: string }} */
    const entry = { url };
    if (lastModified) entry.lastModified = lastModified;
    map.set(url, entry);
  };
  add("/", updated);
  add("/advertise", updated);
  add("/advertise/policy", updated);
  for (const p of pages || []) add(p.path, p.lastModified);
  return [...map.values()];
}

/** @param {string} domain */
export function buildRobots(domain) {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/advertise/thanks", "/api/"] },
    sitemap: `https://${domain}/sitemap.xml`,
    host: `https://${domain}`,
  };
}

/**
 * @param {{ site: { name: string, domain: string, description: string, pages: { path: string, title: string, summary: string, group?: string, updated?: string }[], static: { path: string, title: string }[] }, groups: { name: string, path: string, industries: { name: string, path: string }[] }[] }} input
 */
export function buildLlmsTxt({ site, groups }) {
  const origin = `https://${site.domain}`;
  const lines = [`# ${site.name}`, "", `> ${site.description}`, "", "## Key pages"];
  for (const p of site.pages.filter((p) => p.group !== "tips")) lines.push(`- [${p.title}](${origin}${p.path}): ${p.summary}`);
  const tips = site.pages.filter((p) => p.group === "tips");
  if (tips.length) {
    lines.push("", "## Tips");
    for (const p of tips) lines.push(`- [${p.title}](${origin}${p.path}) (updated ${p.updated || ""}): ${p.summary}`);
  }
  lines.push("", "## Industry groups");
  for (const g of groups) {
    const inds = g.industries.map((i) => `${i.name} (${origin}${i.path})`).join(", ");
    lines.push(`- [${g.name}](${origin}${g.path}): ${inds}`);
  }
  lines.push("", "## About");
  for (const p of site.static) lines.push(`- [${p.title}](${origin}${p.path})`);
  lines.push(
    "",
    "## Advertise",
    `- [Advertise](${origin}/advertise): ${advertiseDescription(site.name)}`,
    `- [Ad Policy](${origin}/advertise/policy): ${adPolicyDescription(site.name)}`,
    "",
  );
  return lines.join("\n");
}
