import site from "../../content/site.json";
import AdOrderForm from "../AdOrderForm";
import { PLANS, CATEGORIES } from "../ads-lib";
export const metadata = { title: "Advertise", description: `Advertise on ${site.name}: labeled, reviewed ads with simple founding pricing.`, alternates: { canonical: "/advertise" } };
export default function Advertise() {
  const plans = Object.values(PLANS);
  return (<article>
    <p className="crumbs"><a href="/">Home</a></p>
    <h1>Advertise on {site.name}</h1>
    <div className="tldr"><strong>Quick answer:</strong> One clearly labeled ad spot per page. Submit your ad, we review it against our <a href="/advertise/policy">Ad Policy</a>, and you only pay after it's approved.</div>
    <section><h2>Who reads {site.name}</h2>
      <p>{site.description}</p>
      <p>{site.sponsorSlot}</p>
      <p>To be upfront: {site.name} is a new site, launched in October 2026, and it's still building its audience. We don't have meaningful traffic numbers to share yet, and our founding prices reflect that. Advertisers get a click count for their ad on request.</p></section>
    <section><h2>Placements and pricing (founding rates)</h2>
      <table><thead><tr><th>Placement</th><th>What you get</th><th>Price</th></tr></thead><tbody>
        {plans.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.desc}</td><td>${p.price / 100} / {p.days} days</td></tr>)}</tbody></table>
      <p className="muted small">Ads appear in the single ad spot near the end of content pages, labeled "Ad". Prices are one-time payments per 30-day run, not subscriptions.</p></section>
    <section><h2>Ad specs</h2><ul>
      <li>Headline: up to 40 characters</li><li>Ad text: up to 120 characters</li><li>Destination URL: one https:// link to your own site</li>
      <li>Optional image: PNG or JPG, up to 1 MB, 600×314 px (or a 300×300 px logo)</li><li>No pop-ups, scripts, tracking pixels or animated ads</li></ul></section>
    <section><h2>How it works</h2><ol>
      <li>Submit your ad below. You'll get an email confirming we received it.</li>
      <li>We review it, usually within 2 business days.</li>
      <li>If it's approved, we email you a secure Stripe payment link. Nothing is charged before that.</li>
      <li>Your ad goes live on your start date and runs for 30 days.</li></ol></section>
    <section>
      <h2>Refunds and cancellation</h2>
      <p>You only pay if we approve your ad and send you a payment link. Nothing is charged before that. Prices are a one-time payment for a 30-day run, not a subscription, and they do not renew automatically.</p>
      <p>If we reject your ad before it runs, you aren't charged. If you somehow already paid, you get a full refund.</p>
      <p>If we remove a running ad, we refund the unused portion of your 30 days.</p>
      <p>If you cancel after your ad starts running, that payment is not refunded.</p>
      <p>We may reject any ad, or remove a running ad, at our discretion.</p>
      <p>These terms also appear in our <a href="/advertise/policy">Ad Policy</a>. The version at the time you order applies to your run.</p>
      <p>Questions? Use the contact form.</p>
    </section>
    <section className="card"><h2>Order an ad</h2><AdOrderForm plans={plans} categories={CATEGORIES} /></section>
  </article>);
}
