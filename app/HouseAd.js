"use client";
import { usePathname } from "next/navigation";
import { BRANDS, SELF } from "./network";
export default function HouseAd({ skip = [] }) {
  const path = usePathname() || "/";
  if (path === "/" || skip.includes(path) || path.startsWith("/api")) return null;
  const pool = BRANDS.filter(b => b.id !== SELF);
  let h = 0; for (const c of path) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const b = pool[h % pool.length];
  const href = `/api/ad-click?b=${b.id}&p=page_bottom&pg=${encodeURIComponent(path)}`;
  return (<aside className="housead" aria-label="Advertisement">
    <span className="housead-tag">From our network · Ad</span>
    <strong className="housead-h">{b.headline}</strong>
    <p>{b.line} <span className="muted small">— {b.name}</span></p>
    <a className="btn" href={href} rel="sponsored noopener">{b.button} →</a>
  </aside>);
}
