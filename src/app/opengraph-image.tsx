import { ImageResponse } from "next/og";

export const alt = "Bachaoo — Your college. Your seniors. Your people.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#f8f7f2", color: "#25251f", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}><div style={{ display: "flex", background: "#d9f879", padding: "0 16px 8px", borderRadius: 14, fontSize: 55, fontWeight: 900 }}>b!</div><span style={{ fontSize: 42, fontWeight: 800 }}>bachaoo.</span></div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 94, fontWeight: 900, letterSpacing: -5, lineHeight: 1.05 }}><span>College is a lot.</span><span style={{ color: "#6751bc" }}>Don’t solo it.</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 25 }}><span>Your college. Your seniors. Your people.</span><span style={{ background: "#d9f879", padding: "16px 24px", borderRadius: 12 }}>Find your crew ↗</span></div>
    </div>,
    size,
  );
}
