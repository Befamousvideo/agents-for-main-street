import site from "../../../content/site.json";
import { competitorText } from "../../ads-lib";
export const metadata = { title: "Ad Policy", description: `What ${site.name} will and won't advertise.`, alternates: { canonical: "/advertise/policy" } };
export default function Policy() {
  return (<article>
    <p className="crumbs"><a href="/">Home</a> / <a href="/advertise">Advertise</a></p>
    <h1>Ad Policy</h1>
    <p>We keep ads useful and trustworthy for our readers. Every ad is reviewed by a person before it runs.</p>
    <section><h2>Who can advertise</h2><ul><li>Legitimate, real businesses and organizations with a working website.</li><li>You must be authorized to advertise the business and the destination link must go to its own site.</li></ul></section>
    <section><h2>What we don't accept</h2><ul>
      <li>Competitors: {competitorText()}.</li>
      <li>Adult or sexual content, pornography, or dating/escort services.</li>
      <li>Gambling, betting or sweepstakes.</li>
      <li>Weapons, ammunition or explosives.</li>
      <li>Drugs, cannabis, tobacco, vaping, or unapproved supplements.</li>
      <li>Cryptocurrency, trading signals, MLM or get-rich-quick schemes.</li>
      <li>Political or issue advocacy ads.</li>
      <li>Health, medical, legal or financial claims or promises of results.</li>
      <li>Deceptive, misleading, hateful or illegal content, fake urgency, or ads that imitate our own content.</li></ul></section>
    <section><h2>Labeling</h2><p>All ads are clearly labeled "Ad". Ads never influence our content.</p></section>
    <section><h2>Review, removal and refunds</h2><ul>
      <li>We may reject any ad, or remove a running ad, at our discretion.</li>
      <li>If we reject your ad before it runs, you aren't charged (and if you somehow already paid, you get a full refund).</li>
      <li>If we remove a running ad, we refund the unused portion of your 30 days.</li>
      <li>Ads you cancel after they start running aren't refunded.</li></ul></section>
    <p className="muted small">Questions? Reply to any email from us. This policy may be updated; the version at the time you order applies to your run.</p>
    <p><a className="btn" href="/advertise">Back to Advertise</a></p>
  </article>);
}
