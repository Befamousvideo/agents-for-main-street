// Affiliate URL helpers. CJS so both Next and the node check script can load this file.
const HIGGSFIELD_AFFILIATE_URL = "https://higgsfield.ai?fpr=vincent-116c2b";
const AFFILIATE_DISCLOSURE = "Affiliate link: we may earn a commission if you sign up, at no cost to you.";
const AFFILIATE_REL = "sponsored nofollow noopener";

const URL_RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;

function isAffiliateUrl(href) {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return host === "higgsfield.ai" && u.searchParams.has("fpr");
  } catch {
    return false;
  }
}

function isToolCard(t) {
  return !!(t && typeof t === "object" && t.card === "tool");
}

function wrapAffiliate(t) {
  return typeof t === "string" && t.includes("higgsfield.ai?fpr=");
}

function externalRel(href) {
  return isAffiliateUrl(href) ? AFFILIATE_REL : "noopener";
}

function splitEmphasis(text) {
  const s = String(text);
  const parts = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ type: "text", text: s.slice(last, m.index) });
    parts.push({ type: "em", text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ type: "text", text: s.slice(last) });
  return parts.length ? parts : [{ type: "text", text: s }];
}

function tokenizeLinks(t) {
  const s = String(t);
  const out = [];
  const pushText = (chunk) => {
    if (!chunk) return;
    const parts = chunk.split(URL_RE);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) out.push({ type: "link", href: parts[i], text: parts[i] });
      else out.push(...splitEmphasis(parts[i]));
    }
  };
  let last = 0;
  for (const m of s.matchAll(MD_LINK_RE)) {
    pushText(s.slice(last, m.index));
    out.push({ type: "link", href: m[2], text: m[1] });
    last = m.index + m[0].length;
  }
  pushText(s.slice(last));
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderInlineHtml(t) {
  return tokenizeLinks(t).map(tok => {
    if (tok.type === "link") {
      const ext = /^https?:\/\//.test(tok.href);
      const attrs = ext ? ` rel="${externalRel(tok.href)}" target="_blank"` : "";
      return `<a href="${escapeHtml(tok.href)}"${attrs}>${escapeHtml(tok.text)}</a>`;
    }
    if (tok.type === "em") return `<em>${escapeHtml(tok.text)}</em>`;
    return escapeHtml(tok.text);
  }).join("");
}

function renderToolCardHtml(card) {
  const extra = /^https?:\/\//.test(card.href) ? ` rel="${externalRel(card.href)}" target="_blank"` : "";
  return `<div class="card tool-card"><h3>${escapeHtml(card.h)}</h3><p>${escapeHtml(card.p)}</p><p>${escapeHtml(card.disclosure)} <a href="${escapeHtml(card.href)}"${extra}>${escapeHtml(card.cta)}</a></p></div>`;
}

function textContainers(value, acc = []) {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) value.forEach(v => textContainers(v, acc));
  else if (isToolCard(value)) acc.push([value.h, value.p, value.disclosure, value.cta, value.href].filter(Boolean).join("\n"));
  else if (value && typeof value === "object") Object.values(value).forEach(v => textContainers(v, acc));
  return acc;
}

function lastOpenP(html, from) {
  const slice = html.slice(0, from);
  let idx = -1;
  const re = /<p(?:\s|>)/gi;
  let m;
  while ((m = re.exec(slice))) idx = m.index;
  return idx;
}

function findAffiliateAnchors(html) {
  const re = /<a\b([^>]*?)href="(https:\/\/higgsfield\.ai\?fpr=vincent-116c2b)"([^>]*)>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const attrs = `${m[1]} ${m[3]}`;
    const rel = (attrs.match(/\brel="([^"]*)"/i) || [])[1] || "";
    const target = (attrs.match(/\btarget="([^"]*)"/i) || [])[1] || "";
    const pStart = lastOpenP(html, m.index);
    const pEnd = html.indexOf("</p>", m.index);
    const pHtml = pStart >= 0 && pEnd > pStart ? html.slice(pStart, pEnd + 4) : "";
    const pOpen = pHtml.match(/^<p\b([^>]*)>/i);
    const pAttrs = pOpen ? pOpen[1] : "";
    const pInner = pHtml.replace(/^<p\b[^>]*>/i, "").replace(/<\/p>$/i, "");
    const nearby = html.slice(Math.max(0, m.index - 400), m.index + 400);
    out.push({
      href: m[2],
      rel,
      target,
      pHtml,
      pAttrs,
      pInner,
      discIdx: pInner.indexOf(AFFILIATE_DISCLOSURE),
      linkIdx: pInner.search(/<a\b/i),
      nearby
    });
  }
  return out;
}

module.exports = {
  HIGGSFIELD_AFFILIATE_URL,
  AFFILIATE_DISCLOSURE,
  AFFILIATE_REL,
  isAffiliateUrl,
  isToolCard,
  wrapAffiliate,
  externalRel,
  tokenizeLinks,
  renderInlineHtml,
  renderToolCardHtml,
  textContainers,
  findAffiliateAnchors
};
