import Script from "next/script";
import { gaBootstrap } from "./analytics";

export default function GoogleAnalytics() {
  const tag = gaBootstrap(process.env.NEXT_PUBLIC_GA_ID);
  if (!tag) return null;
  return (
    <>
      <Script src={tag.src} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="beforeInteractive">{tag.inline}</Script>
    </>
  );
}
