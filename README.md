# Agents for Main Street

Next.js App Router site for agentsformainstreet.com. Content lives in content/site.json. Part of Agentic Business (StorenTech).

Placeholders: newsletter (Resend not connected), Stripe/sponsor CTAs (no keys), forms disabled except /build-it-for-me (live: /api/build-request → Blob build-requests/ + Resend email).

## Analytics

`NEXT_PUBLIC_GA_ID` is optional. Set it to a GA4 measurement ID (`G-XXXXXXXX`) to load the Google tag. When the variable is unset or not a measurement ID, the tag is not loaded and event calls do nothing, so the site is safe to ship before the ID exists.

Events never include names, email addresses, phone numbers, or message text:

- `generate_lead` on a successful newsletter, build-request, or ad-order submit
- `cta_click` with `{ cta_label, cta_location }` on primary CTA and form button clicks

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` are the checks for this app.
