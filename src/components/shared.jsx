// ─── Theme ──────────────────────────────────────────────────────
export const C = {
  bg: "#F5F0E8", card: "#FFFFFF", green: "#2D5A3D", greenLight: "#3A7550",
  greenPale: "#E8F0EA", cream: "#FAF7F0", text: "#1A1A1A", textMuted: "#6B6B6B",
  red: "#C44D4D", redPale: "#FDF0F0", amber: "#B8860B", amberPale: "#FFF8E7",
  border: "#E0DDD5",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 12px rgba(0,0,0,0.08)",
};
export const font = "'Instrument Serif', Georgia, serif";
export const fontMono = "'DM Mono', 'SF Mono', monospace";
export const fontSans = "'DM Sans', 'Helvetica Neue', sans-serif";
export const CATEGORIES = ["Coffee", "Pastry", "Kombucha"];
export const UNITS = ["kg", "L", "unit", "g", "mL", "cl"];
export const PERIODS = [{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "full_day", label: "Full Day" }];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const catColors = { "Coffee": { bg: "#F0E8D8", color: "#7A5C2E" }, "Pastry": { bg: "#F5E8EE", color: "#8A3A5C" }, "Kombucha": { bg: "#E4F0E8", color: "#2D5A3D" } };

// ─── Shared Components ──────────────────────────────────────────
export function Badge({ children, color = C.green, bg = C.greenPale }) {
  return <span style={{ display: "inline-block", fontSize: 11, fontFamily: fontSans, fontWeight: 600, padding: "2px 8px", borderRadius: 4, color, background: bg, letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</span>;
}
export function Metric({ label, value, unit = "€", size = "normal", alert = false }) {
  const sm = size === "small";
  return (<div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: fontSans, fontSize: sm ? 10 : 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
    <div style={{ fontFamily: fontMono, fontSize: sm ? 18 : 26, fontWeight: 700, color: alert ? C.red : C.green, lineHeight: 1.1 }}>{value}<span style={{ fontSize: sm ? 12 : 16, fontWeight: 400, color: C.textMuted }}>{unit}</span></div>
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
      <div style={{ position: "absolute", left: `${target}%`, top: -2, width: 2, height: 10, background: C.text, borderRadius: 1, opacity: 0.4 }} />
    </div>
    <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>Target: {target}%</div>
  </div>);
}
export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (<div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }} onClick={onClose}>
    <div style={{ background: C.card, borderRadius: 12, padding: 28, maxWidth: wide ? 720 : 560, width: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: C.shadowLg }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontFamily: font, fontSize: 22, margin: 0, color: C.green }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
      </div>
      {children}
    </div>
  </div>);
}
export function Btn({ children, onClick, variant = "primary", style: sx, disabled }) {
  const p = variant === "primary";
  return <button disabled={disabled} onClick={onClick} style={{ padding: "8px 18px", borderRadius: 6, border: p ? "none" : `1px solid ${C.border}`, background: p ? C.green : "transparent", color: p ? "#fff" : C.text, fontFamily: fontSans, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...sx }}>{children}</button>;
}
export function SaveIndicator({ status }) {
  if (!status) return null;
  const m = { saving: { t: "…", c: C.amber }, saved: { t: "✓ Saved", c: "#8FD5A6" }, error: { t: "Error", c: C.red } };
  const s = m[status] || m.saved;
  return <span style={{ fontFamily: fontSans, fontSize: 11, color: s.c }}>{s.t}</span>;
}
