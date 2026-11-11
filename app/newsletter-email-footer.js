import site from "../content/site.json";

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** CAN-SPAM footer for Agents for Main Street newsletter emails. No email address. */
export function newsletterEmailFooterHtml() {
  const lines = site.newsletter.emailFooter || [];
  return `<p>${lines.map(esc).join("<br>")}</p>`;
}

export function newsletterEmailFooterText() {
  return (site.newsletter.emailFooter || []).join("\n");
}
