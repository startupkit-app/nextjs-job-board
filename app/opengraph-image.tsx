import { ImageResponse } from "next/og";

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our company";

export const alt = `Careers at ${companyName}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #18181b 0%, #312e81 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: 36,
            color: "#a5b4fc",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#4f46e5",
              color: "#ffffff",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            {companyName.charAt(0).toUpperCase()}
          </div>
          {companyName}
        </div>
        <div style={{ marginTop: 48, fontSize: 88, fontWeight: 700, lineHeight: 1.05 }}>
          We&apos;re hiring.
        </div>
        <div style={{ marginTop: 28, fontSize: 36, color: "#d4d4d8" }}>
          Browse open roles and apply online.
        </div>
      </div>
    ),
    { ...size }
  );
}
