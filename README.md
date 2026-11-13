# Agents for Main Street

Next.js App Router site for agentsformainstreet.com. Content lives in content/site.json. Part of Agentic Business (StorenTech).

Placeholders: newsletter (Resend not connected), Stripe/sponsor CTAs (no keys), forms disabled except /build-it-for-me (live: /api/build-request → Blob build-requests/ + Resend email).

Content rule: never publish vaccine or flu-shot topics (see ab-daily/CONTENT-RULES.md).

## Environment

Optional public variables (not secrets). Copy `.env.example`. Do not commit values.

- `NEXT_PUBLIC_GA_ID` — GA4 measurement ID. If unset, the site uses `G-ECB8CXZGD7`. Google Analytics loads only after the visitor allows analytics cookies.
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` — Google Search Console HTML-tag verification token. When set, Next.js `metadata.verification.google` emits `<meta name="google-site-verification" content="...">`. When unset, the tag is omitted. This is not a DNS record.

Vercel Analytics and Speed Insights stay enabled. Do not add other trackers.
