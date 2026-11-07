import { ImageResponse } from "next/og";

export const alt = "Topovik — подборки и топы";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f5f2ea",
          color: "#0a0a0a",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#00a8ff",
            }}
          >
            Topovik /
          </div>
          <div
            style={{
              width: 56,
              height: 56,
              background: "#00a8ff",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
              maxWidth: 920,
            }}
          >
            Подборки и топы
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.35,
              color: "#6a6a6a",
              maxWidth: 760,
            }}
          >
            Кино, технологии, путешествия, юмор и не только.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "3px solid #0a0a0a",
            paddingTop: 28,
            fontSize: 22,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#6a6a6a",
          }}
        >
          <span>Журнал подборок</span>
          <span style={{ color: "#0a0a0a", fontWeight: 700 }}>topovik.com</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
