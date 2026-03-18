import { C, fontSans, fontMono, Btn } from "./shared.jsx";

const features = [
  { icon: "📊", title: "Recipe Costing", desc: "Know your exact cost per cup, per pastry, per serving." },
  { icon: "📈", title: "Shift P&L", desc: "Track daily revenue, labor, and profit in real time." },
  { icon: "🎯", title: "Menu Engineering", desc: "Identify your stars, hidden gems, and underperformers." },
];

export default function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div style={{
      height: "100vh", overflow: "hidden", background: C.bg,
      display: "flex", flexDirection: "column", fontFamily: fontSans, color: C.text,
    }}>
      {/* Nav */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 32px", background: C.card, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>☕</span> Café Pilot
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={onLogin} style={{ fontSize: 13, padding: "6px 16px" }}>Log in</Btn>
          <Btn onClick={onGetStarted} style={{ fontSize: 13, padding: "6px 16px" }}>Get started free</Btn>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "0 32px", textAlign: "center",
      }}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 48 }}>☕</span>
        </div>

        <h1 style={{
          fontFamily: fontSans, fontSize: 44, fontWeight: 800, lineHeight: 1.1,
          margin: "0 0 16px", maxWidth: 600, letterSpacing: "-0.02em",
        }}>
          Know your margins<br />
          <span style={{ color: C.textMuted }}>before your shift starts</span>
        </h1>

        <p style={{
          fontSize: 17, color: C.textMuted, maxWidth: 480, margin: "0 0 32px",
          lineHeight: 1.5,
        }}>
          The cost management tool built for café owners and baristas.
          Track recipes, shifts, and profitability — all in one place.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 48 }}>
          <Btn onClick={onGetStarted} style={{ fontSize: 15, padding: "10px 28px" }}>
            Get started — it's free
          </Btn>
          <Btn variant="secondary" onClick={onLogin} style={{ fontSize: 15, padding: "10px 28px" }}>
            Log in
          </Btn>
        </div>

        {/* Feature pills */}
        <div style={{
          display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center",
        }}>
          {features.map((f) => (
            <div key={f.title} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: "16px 24px", maxWidth: 220, textAlign: "left",
              boxShadow: C.shadow,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 32px", textAlign: "center",
        fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.border}`,
      }}>
        Built for independent coffee shops · No credit card required
      </div>
    </div>
  );
}
