// ─── Theme — Notion-inspired warm neutrals ──────────────────────
export const C = {
  bg: "#F7F6F3",        // Warm off-white (Notion background)
  card: "#FFFFFF",       // Clean white cards
  green: "#2B593F",      // Muted forest — positive values, profit
  greenLight: "#3D7A56",
  greenPale: "#EDF5F0",
  cream: "#F7F6F3",      // Matches bg for nested sections
  text: "#37352F",       // Notion's warm dark (not pure black)
  textMuted: "#9B9A97",  // Notion's secondary text
  red: "#EB5757",        // Notion red — losses, alerts
  redPale: "#FDECEC",
  amber: "#CB912F",      // Notion amber — warnings
  amberPale: "#FBF3DB",
  border: "#E3E2DE",     // Notion's subtle divider
  shadow: "0 1px 2px rgba(55,53,47,0.04)",
  shadowLg: "0 4px 8px rgba(55,53,47,0.06)",
};
export const font = "'DM Sans', 'Helvetica Neue', sans-serif";
export const fontMono = "'DM Mono', 'SF Mono', monospace";
export const fontSans = "'DM Sans', 'Helvetica Neue', sans-serif";
export const CATEGORIES = ["Coffee", "Pastry", "Kombucha"];
export const UNITS = ["kg", "L", "unit", "g", "mL", "cl"];
export const PERIODS = [{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "full_day", label: "Full Day" }];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const catColors = {
  "Coffee": { bg: "#F3EEE7", color: "#8B6914" },
  "Pastry": { bg: "#F5EEF1", color: "#9B4DCA" },
  "Kombucha": { bg: "#E8F3ED", color: "#2B593F" },
};

// ─── Shared Components ──────────────────────────────────────────
export function Badge({ children, color = C.green, bg = C.greenPale }) {
  return <span style={{ display: "inline-block", fontSize: 11, fontFamily: fontSans, fontWeight: 600, padding: "2px 8px", borderRadius: 4, color, background: bg, letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</span>;
}
export function Metric({ label, value, unit = "\u20AC", size = "normal", alert = false }) {
  const sm = size === "small";
  return (<div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: fontSans, fontSize: sm ? 10 : 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
    <div style={{ fontFamily: fontMono, fontSize: sm ? 18 : 26, fontWeight: 700, color: alert ? C.red : C.text, lineHeight: 1.1 }}>{value}<span style={{ fontSize: sm ? 12 : 16, fontWeight: 400, color: C.textMuted }}>{unit}</span></div>
  </div>);
}
export function MarginBar({ margin, target }) {
  const barColor = margin >= target ? C.green : margin >= target - 5 ? C.amber : C.red;
  return (<div style={{ width: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted }}>Actual margin</span>
      <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: barColor }}>{margin.toFixed(1)}%</span>
    </div>
    <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, position: "relative" }}>
      <div style={{ width: `${Math.min(margin, 100)}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.4s ease" }} />
      <div style={{ position: "absolute", left: `${target}%`, top: -2, width: 2, height: 10, background: C.text, borderRadius: 1, opacity: 0.3 }} />
    </div>
    <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>Target: {target}%</div>
  </div>);
}
export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (<div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,15,15,0.6)", padding: 16 }} onClick={onClose}>
    <div style={{ background: C.card, borderRadius: 8, padding: 28, maxWidth: wide ? 720 : 560, width: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: "0 8px 24px rgba(55,53,47,0.12)" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 700, margin: 0, color: C.text }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textMuted, padding: 4, borderRadius: 4 }}>×</button>
      </div>
      {children}
    </div>
  </div>);
}
export function Btn({ children, onClick, variant = "primary", style: sx, disabled }) {
  const p = variant === "primary";
  return <button disabled={disabled} onClick={onClick} style={{
    padding: "7px 16px", borderRadius: 6,
    border: p ? "none" : `1px solid ${C.border}`,
    background: p ? C.text : "transparent",
    color: p ? "#fff" : C.text,
    fontFamily: fontSans, fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s ease",
    ...sx
  }}>{children}</button>;
}
/**
 * Reusable P&L waterfall table.
 * rows: [{ label, value, line?, bold?, final? }]
 * maxWidth: optional CSS maxWidth (default 400)
 */
export function PLWaterfall({ rows, maxWidth = 400 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth }}>
      {rows.map((r, i) => (
        <div key={i}>
          {r.line && <div style={{ borderTop: r.final ? `2px solid ${C.text}` : `1px solid ${C.border}`, marginBottom: 6, marginTop: 4 }} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
            <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: r.bold ? 700 : 400, color: r.final ? (r.value >= 0 ? C.green : C.red) : C.text }}>{r.label}</span>
            <span style={{ fontFamily: fontMono, fontSize: 14, fontWeight: r.bold ? 700 : 400, color: r.value < 0 ? C.red : (r.final && r.value >= 0 ? C.green : C.text) }}>
              {r.value < 0 ? `-€${Math.abs(r.value).toFixed(0)}` : `€${r.value.toFixed(0)}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
export function SaveIndicator({ status }) {
  if (!status) return null;
  const m = { saving: { t: "Saving…", c: C.textMuted }, saved: { t: "Saved", c: C.textMuted }, error: { t: "Error saving", c: C.red } };
  const s = m[status] || m.saved;
  return <span style={{ fontFamily: fontSans, fontSize: 11, color: s.c, opacity: status === "saved" ? 0.6 : 1 }}>{s.t}</span>;
}
