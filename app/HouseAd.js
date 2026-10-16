"use client";
// Neutral class/route names on purpose: ad blockers hide elements named "housead", aria-label="Advertisement" and /ad-click links.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BRANDS, SELF } from "./network";
export default function HouseAd() {
  const path = usePathname() || "/";
  const [paid, setPaid] = useState(null);
  useEffect(() => { let on = true; fetch(`/api/n/slot?pg=${encodeURIComponent(path)}`).then(r => r.json()).then(j => { if (on && j && j.ad) setPaid(j.ad); }).catch(() => {}); return () => { on = false; }; }, [path]);
  const pool = BRANDS.filter(b => b.id !== SELF);
  let h = 0; for (const c of path) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const b = pool[h % pool.length];
  const ad = paid ? { tag: "Sponsored · Ad", h: paid.headline, line: paid.body, name: paid.name, img: paid.img, btn: "Learn more", href: `/api/go?a=${paid.id}&p=slot&pg=${encodeURIComponent(path)}` }
    : { tag: "From our network · Ad", h: b.headline, line: b.line, name: b.name, btn: b.button, href: `/api/go?b=${b.id}&p=slot&pg=${encodeURIComponent(path)}` };
  return (<aside className="netpick" aria-label="From our network">
    <div className="netpick-top"><span className="netpick-tag">{ad.tag}</span><a className="netpick-adv" href="/advertise">Advertise here</a></div>
    <div className="netpick-row">{ad.img && <img src={ad.img} alt="" width="120" height="63" className="netpick-img" />}<div>
      <strong className="netpick-h">{ad.h}</strong>
      <p>{ad.line} <span className="muted small">— {ad.name}</span></p>
      <a className="btn" href={ad.href} rel="sponsored noopener">{ad.btn} →</a></div></div>
  </aside>);
}
