import { ImageResponse } from "next/og";
import site from "../content/site.json";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#1F6F50",
          color: "#ffffff",
          padding: "80px 88px",
        }}
      >
        <div style={{ fontSize: 72, lineHeight: 1.1 }}>{site.name}</div>
        <div style={{ fontSize: 36, lineHeight: 1.3, marginTop: 28 }}>{site.tagline}</div>
      </div>
    ),
    { ...size }
  );
}
