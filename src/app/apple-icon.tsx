import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#d9f879", color: "#25251f", fontSize: 140, fontWeight: 900, letterSpacing: -15, paddingBottom: 12 }}>b!</div>,
    size,
  );
}
