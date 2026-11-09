// Affiliate URL helpers. CJS so both Next and the node check script can load this file.
const HIGGSFIELD_AFFILIATE_URL = "https://higgsfield.ai?fpr=vincent-116c2b";
const AFFILIATE_DISCLOSURE = "Affiliate link: we may earn a commission at no extra cost to you.";

const URL_RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

function isAffiliateUrl(href) {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return host === "higgsfield.ai" && u.searchParams.has("fpr");
  } catch {
    return false;
  }
}

function externalRel(href) {
  return isAffiliateUrl(href) ? "sponsored nofollow noopener" : "noopener";
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
      else out.push({ type: "text", text: parts[i] });
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

module.exports = {
  HIGGSFIELD_AFFILIATE_URL,
  AFFILIATE_DISCLOSURE,
  isAffiliateUrl,
  externalRel,
  tokenizeLinks
};
