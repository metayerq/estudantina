import { useState, useEffect, useCallback, useMemo, useRef } from "react";
// ─── Storage ────────────────────────────────────────────────────
const store = {
  async get(k) { try { if (window.storage?.get) { const r = await window.storage.get(k); return r?.value??null; } } catch {} try { return localStorage?.getItem(k)??null; } catch { return null; } },
  async set(k, v) { try { if (window.storage?.set) { await window.storage.set(k, v); return; } } catch {} try { localStorage?.setItem(k, v); } catch {} },
};
// ─── Theme ──────────────────────────────────────────────────────
const C = {
  bg: "#F5F0E8", card: "#FFFFFF", green: "#2D5A3D", greenLight: "#3A7550",
  greenPale: "#E8F0EA", cream: "#FAF7F0", text: "#1A1A1A", textMuted: "#6B6B6B",
  red: "#C44D4D", redPale: "#FDF0F0", amber: "#B8860B", amberPale: "#FFF8E7",
  border: "#E0DDD5",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 12px rgba(0,0,0,0.08)",
};
const font = "'Instrument Serif', Georgia, serif";
const fontMono = "'DM Mono', 'SF Mono', monospace";
const fontSans = "'DM Sans', 'Helvetica Neue', sans-serif";
const CATEGORIES = ["Coffee", "Pastry", "Kombucha"];
const UNITS = ["kg", "L", "unit", "g", "mL", "cl"];
const uid = () => Math.random().toString(36).slice(2, 10);
const catColors = { "Coffee": { bg: "#F0E8D8", color: "#7A5C2E" }, "Pastry": { bg: "#F5E8EE", color: "#8A3A5C" }, "Kombucha": { bg: "#E4F0E8", color: "#2D5A3D" } };
const calcRecipeCost = (recipe, ingredients) => {
  let total = 0;
  for (const item of recipe.items) { const ing = ingredients.find(i => i.id === item.ingredientId); if (ing) total += ing.pricePerUnit * item.qty * (ing.wasteFactor || 1); }
  return total;
};
const calcUnitCost = (recipe, ingredients) => { const t = calcRecipeCost(recipe, ingredients); return recipe.portions > 0 ? t / recipe.portions : 0; };
const getMargin = (sp, uc) => sp > 0 ? ((sp - uc) / sp) * 100 : 0;
// ─── Shared Components ──────────────────────────────────────────
function Badge({ children, color = C.green, bg = C.greenPale }) {
  return <span style={{ display: "inline-block", fontSize: 11, fontFamily: fontSans, fontWeight: 600, padding: "2px 8px", borderRadius: 4, color, background: bg, letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</span>;
}
function Metric({ label, value, unit = "€", size = "normal", alert = false }) {
  const sm = size === "small";
  return (<div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: fontSans, fontSize: sm ? 10 : 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
    <div style={{ fontFamily: fontMono, fontSize: sm ? 18 : 26, fontWeight: 700, color: alert ? C.red : C.green, lineHeight: 1.1 }}>{value}<span style={{ fontSize: sm ? 12 : 16, fontWeight: 400, color: C.textMuted }}>{unit}</span></div>
  </div>);
}
function MarginBar({ margin, target }) {
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
function Modal({ open, onClose, title, children, wide }) {
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
function Btn({ children, onClick, variant = "primary", style: sx, disabled }) {
  const p = variant === "primary";
  return <button disabled={disabled} onClick={onClick} style={{ padding: "8px 18px", borderRadius: 6, border: p ? "none" : `1px solid ${C.border}`, background: p ? C.green : "transparent", color: p ? "#fff" : C.text, fontFamily: fontSans, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...sx }}>{children}</button>;
}
function SaveIndicator({ status }) {
  if (!status) return null;
  const m = { saving: { t: "…", c: C.amber }, saved: { t: "✓ Saved", c: "#8FD5A6" }, error: { t: "Error", c: C.red } };
  const s = m[status] || m.saved;
  return <span style={{ fontFamily: fontSans, fontSize: 11, color: s.c }}>{s.t}</span>;
}
// ─── Default Data ───────────────────────────────────────────────
const DEFAULT_INGREDIENTS = [
  { id: "1", name: "Olisipo Coffee Beans", unit: "kg", pricePerUnit: 22.0, supplier: "Olisipo", wasteFactor: 1.0 },
  { id: "2", name: "Whole Milk", unit: "L", pricePerUnit: 0.89, supplier: "Makro", wasteFactor: 1.03 },
  { id: "3", name: "Oatly Oat Milk", unit: "L", pricePerUnit: 2.49, supplier: "Makro", wasteFactor: 1.02 },
  { id: "4", name: "White Sugar", unit: "kg", pricePerUnit: 1.10, supplier: "Makro", wasteFactor: 1.0 },
  { id: "5", name: "All-Purpose Flour (T55)", unit: "kg", pricePerUnit: 0.85, supplier: "Makro", wasteFactor: 1.02 },
  { id: "6", name: "Unsalted Butter", unit: "kg", pricePerUnit: 7.50, supplier: "Makro", wasteFactor: 1.0 },
  { id: "7", name: "Eggs (each)", unit: "unit", pricePerUnit: 0.18, supplier: "Makro", wasteFactor: 1.10 },
  { id: "8", name: "Dark Chocolate 70%", unit: "kg", pricePerUnit: 12.50, supplier: "Makro", wasteFactor: 1.03 },
  { id: "9", name: "Crème fraîche", unit: "L", pricePerUnit: 3.20, supplier: "Makro", wasteFactor: 1.05 },
  { id: "10", name: "Green Tea (SCOBY base)", unit: "kg", pricePerUnit: 18.00, supplier: "Various", wasteFactor: 1.0 },
  { id: "11", name: "SCOBY / starter", unit: "L", pricePerUnit: 0.50, supplier: "House", wasteFactor: 1.0 },
  { id: "12", name: "Fresh Ginger", unit: "kg", pricePerUnit: 5.80, supplier: "Mercado", wasteFactor: 1.15 },
  { id: "13", name: "Lemon", unit: "unit", pricePerUnit: 0.25, supplier: "Mercado", wasteFactor: 1.08 },
  { id: "14", name: "Dried Lavender", unit: "g", pricePerUnit: 0.06, supplier: "Ervanária", wasteFactor: 1.0 },
  { id: "15", name: "12oz Cup", unit: "unit", pricePerUnit: 0.08, supplier: "Makro", wasteFactor: 1.0 },
  { id: "16", name: "Take-away Lid", unit: "unit", pricePerUnit: 0.03, supplier: "Makro", wasteFactor: 1.0 },
  { id: "17", name: "Kombucha Bottle 33cl", unit: "unit", pricePerUnit: 0.35, supplier: "Makro", wasteFactor: 1.0 },
  { id: "18", name: "Sliced Almonds", unit: "kg", pricePerUnit: 14.00, supplier: "Makro", wasteFactor: 1.05 },
  { id: "19", name: "Baker's Yeast", unit: "g", pricePerUnit: 0.008, supplier: "Makro", wasteFactor: 1.0 },
  { id: "20", name: "Vanilla Extract", unit: "mL", pricePerUnit: 0.12, supplier: "Makro", wasteFactor: 1.0 },
  { id: "21", name: "BWT Filtered Water", unit: "L", pricePerUnit: 0.005, supplier: "BWT", wasteFactor: 1.0 },
  { id: "22", name: "Cream Cheese", unit: "kg", pricePerUnit: 6.80, supplier: "Makro", wasteFactor: 1.02 },
  { id: "23", name: "Speculoos Biscuits", unit: "kg", pricePerUnit: 4.50, supplier: "Makro", wasteFactor: 1.0 },
  { id: "24", name: "Ground Cinnamon", unit: "g", pricePerUnit: 0.03, supplier: "Makro", wasteFactor: 1.0 },
  { id: "25", name: "Matcha Powder", unit: "g", pricePerUnit: 0.18, supplier: "Various", wasteFactor: 1.0 },
  { id: "26", name: "Maple Syrup", unit: "mL", pricePerUnit: 0.04, supplier: "Makro", wasteFactor: 1.0 },
  { id: "27", name: "Puff Pastry", unit: "kg", pricePerUnit: 3.20, supplier: "Makro", wasteFactor: 1.05 },
  { id: "28", name: "Red Berry Jam", unit: "kg", pricePerUnit: 5.50, supplier: "Mercado", wasteFactor: 1.0 },
  { id: "29", name: "Fresh Fruits (mix)", unit: "kg", pricePerUnit: 4.20, supplier: "Mercado", wasteFactor: 1.20 },
  { id: "30", name: "Chai Concentrate", unit: "L", pricePerUnit: 8.50, supplier: "Various", wasteFactor: 1.0 },
  { id: "31", name: "Chocolate Chips", unit: "kg", pricePerUnit: 9.00, supplier: "Makro", wasteFactor: 1.0 },
  { id: "32", name: "Cocoa Powder", unit: "g", pricePerUnit: 0.02, supplier: "Makro", wasteFactor: 1.0 },
];
const DEFAULT_RECIPES = [
  { id: "r1", name: "Espresso", category: "Coffee", portions: 1, targetMargin: 85, sellingPrice: 1.40, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "21", qty: 0.03 }] },
  { id: "r2", name: "Doppio", category: "Coffee", portions: 1, targetMargin: 83, sellingPrice: 2.00, items: [{ ingredientId: "1", qty: 0.036 }, { ingredientId: "21", qty: 0.06 }] },
  { id: "r3", name: "Americano", category: "Coffee", portions: 1, targetMargin: 82, sellingPrice: 2.50, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "21", qty: 0.20 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r4", name: "Flat White", category: "Coffee", portions: 1, targetMargin: 78, sellingPrice: 3.50, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.18 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r5", name: "Flat White Oat", category: "Coffee", portions: 1, targetMargin: 72, sellingPrice: 4.00, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "3", qty: 0.18 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r6", name: "Cappuccino", category: "Coffee", portions: 1, targetMargin: 78, sellingPrice: 3.20, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.15 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "32", qty: 1 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r7", name: "Cortado", category: "Coffee", portions: 1, targetMargin: 80, sellingPrice: 2.80, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.06 }, { ingredientId: "21", qty: 0.03 }] },
  { id: "r8", name: "Latte", category: "Coffee", portions: 1, targetMargin: 75, sellingPrice: 3.80, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.25 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r9", name: "Matcha Latte", category: "Coffee", portions: 1, targetMargin: 70, sellingPrice: 4.50, items: [{ ingredientId: "25", qty: 3 }, { ingredientId: "3", qty: 0.25 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r10", name: "Chai Latte", category: "Coffee", portions: 1, targetMargin: 72, sellingPrice: 4.00, items: [{ ingredientId: "30", qty: 0.06 }, { ingredientId: "2", qty: 0.20 }, { ingredientId: "21", qty: 0.05 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r11", name: "Homemade Pastel de Nata", category: "Pastry", portions: 12, targetMargin: 75, sellingPrice: 1.80, items: [{ ingredientId: "5", qty: 0.25 }, { ingredientId: "6", qty: 0.15 }, { ingredientId: "7", qty: 6 }, { ingredientId: "4", qty: 0.20 }, { ingredientId: "2", qty: 0.5 }, { ingredientId: "9", qty: 0.1 }, { ingredientId: "20", qty: 5 }] },
  { id: "r12", name: "Chocolate Brownie", category: "Pastry", portions: 16, targetMargin: 78, sellingPrice: 2.80, items: [{ ingredientId: "8", qty: 0.30 }, { ingredientId: "6", qty: 0.20 }, { ingredientId: "4", qty: 0.25 }, { ingredientId: "7", qty: 4 }, { ingredientId: "5", qty: 0.10 }] },
  { id: "r13", name: "Cheesecake", category: "Pastry", portions: 10, targetMargin: 74, sellingPrice: 3.50, items: [{ ingredientId: "22", qty: 0.50 }, { ingredientId: "23", qty: 0.15 }, { ingredientId: "6", qty: 0.10 }, { ingredientId: "7", qty: 3 }, { ingredientId: "4", qty: 0.12 }, { ingredientId: "9", qty: 0.15 }, { ingredientId: "20", qty: 5 }] },
  { id: "r14", name: "Chocolate Chip Cookie", category: "Pastry", portions: 20, targetMargin: 80, sellingPrice: 2.20, items: [{ ingredientId: "6", qty: 0.18 }, { ingredientId: "4", qty: 0.20 }, { ingredientId: "5", qty: 0.30 }, { ingredientId: "7", qty: 2 }, { ingredientId: "31", qty: 0.15 }, { ingredientId: "20", qty: 3 }] },
  { id: "r15", name: "Butter Croissant", category: "Pastry", portions: 10, targetMargin: 76, sellingPrice: 1.60, items: [{ ingredientId: "27", qty: 0.50 }, { ingredientId: "6", qty: 0.15 }, { ingredientId: "7", qty: 1 }, { ingredientId: "4", qty: 0.03 }] },
  { id: "r16", name: "Fresh Fruit Tart", category: "Pastry", portions: 8, targetMargin: 72, sellingPrice: 3.80, items: [{ ingredientId: "27", qty: 0.25 }, { ingredientId: "9", qty: 0.20 }, { ingredientId: "4", qty: 0.10 }, { ingredientId: "7", qty: 3 }, { ingredientId: "29", qty: 0.30 }, { ingredientId: "20", qty: 3 }] },
  { id: "r17", name: "Cinnamon Roll", category: "Pastry", portions: 8, targetMargin: 77, sellingPrice: 3.00, items: [{ ingredientId: "5", qty: 0.30 }, { ingredientId: "6", qty: 0.12 }, { ingredientId: "4", qty: 0.15 }, { ingredientId: "7", qty: 2 }, { ingredientId: "24", qty: 8 }, { ingredientId: "19", qty: 5 }, { ingredientId: "26", qty: 20 }] },
  { id: "r18", name: "Kombucha Ginger-Lemon", category: "Kombucha", portions: 10, targetMargin: 80, sellingPrice: 3.50, items: [{ ingredientId: "10", qty: 0.015 }, { ingredientId: "4", qty: 0.08 }, { ingredientId: "11", qty: 0.3 }, { ingredientId: "12", qty: 0.05 }, { ingredientId: "13", qty: 2 }, { ingredientId: "21", qty: 3.0 }, { ingredientId: "17", qty: 10 }] },
  { id: "r19", name: "Kombucha Lavender", category: "Kombucha", portions: 10, targetMargin: 80, sellingPrice: 3.50, items: [{ ingredientId: "10", qty: 0.015 }, { ingredientId: "4", qty: 0.08 }, { ingredientId: "11", qty: 0.3 }, { ingredientId: "14", qty: 8 }, { ingredientId: "21", qty: 3.0 }, { ingredientId: "17", qty: 10 }] },
];
// ─── Components ─────────────────────────────────────────────────
function RecipeCard({ recipe, ingredients, onEdit, onDelete }) {
  const unitCost = calcUnitCost(recipe, ingredients);
  const margin = getMargin(recipe.sellingPrice, unitCost);
  const suggestedPrice = recipe.targetMargin < 100 ? unitCost / (1 - recipe.targetMargin / 100) : 0;
  const isUnder = margin < recipe.targetMargin && recipe.sellingPrice > 0;
  const cc = catColors[recipe.category] || { bg: C.greenPale, color: C.green };
  const wc = recipe.items.filter(item => { const ing = ingredients.find(i => i.id === item.ingredientId); return ing && (ing.wasteFactor || 1) > 1; }).length;
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: isUnder ? `1px solid ${C.red}30` : `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div><Badge color={cc.color} bg={cc.bg}>{recipe.category}</Badge><h4 style={{ fontFamily: font, fontSize: 19, margin: "6px 0 0" }}>{recipe.name}</h4><div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>{recipe.portions > 1 ? `${recipe.portions} portions` : "1 portion"}{wc > 0 && <span style={{ marginLeft: 6, color: C.amber, fontSize: 11 }}>· {wc} with waste</span>}</div></div>
        <div style={{ display: "flex", gap: 6 }}><button onClick={() => onEdit(recipe)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>✎</button><button onClick={() => onDelete(recipe.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.red }}>✕</button></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14, padding: "12px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Metric label="Cost/unit" value={unitCost.toFixed(2)} size="small" /><Metric label="Selling price" value={recipe.sellingPrice.toFixed(2)} size="small" /><Metric label="Target price" value={suggestedPrice.toFixed(2)} size="small" alert={recipe.sellingPrice < suggestedPrice} />
      </div>
      <MarginBar margin={margin} target={recipe.targetMargin} />
      {isUnder && <div style={{ marginTop: 10, padding: "8px 10px", background: C.redPale, borderRadius: 6, fontFamily: fontSans, fontSize: 11, color: C.red }}>⚠ Min. suggested price: <strong>{suggestedPrice.toFixed(2)}€</strong></div>}
    </div>
  );
}
function IngredientModal({ open, onClose, ingredients, onSave }) {
  const [list, setList] = useState(ingredients);
  const [n, setN] = useState({ name: "", unit: "kg", pricePerUnit: "", supplier: "", wasteFactor: "1.0" });
  useEffect(() => { setList(ingredients); }, [ingredients]);
  return (
    <Modal open={open} onClose={onClose} title="Ingredient base" wide>
      <div style={{ padding: "8px 12px", background: C.amberPale, borderRadius: 6, marginBottom: 14, fontFamily: fontSans, fontSize: 12, color: C.amber }}><strong>Waste factor</strong>: 1.00 = no waste. 1.10 = 10% waste.</div>
      <div style={{ maxHeight: 350, overflow: "auto", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Ingredient</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Price/u</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Waste</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Real cost</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Supplier</th><th style={{ width: 28 }}></th></tr></thead>
          <tbody>{list.map(ing => { const rc = ing.pricePerUnit * (ing.wasteFactor || 1); const hw = (ing.wasteFactor || 1) > 1; return (<tr key={ing.id} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "5px 6px" }}>{ing.name} <span style={{ color: C.textMuted, fontSize: 11 }}>/{ing.unit}</span></td><td style={{ padding: "5px 6px" }}><input type="number" step="0.01" value={ing.pricePerUnit} onChange={e => setList(list.map(i => i.id === ing.id ? { ...i, pricePerUnit: parseFloat(e.target.value) || 0 } : i))} style={{ width: 64, padding: "3px 5px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: C.cream }} />€</td><td style={{ padding: "5px 6px" }}><input type="number" step="0.01" min="1" value={ing.wasteFactor ?? 1} onChange={e => setList(list.map(i => i.id === ing.id ? { ...i, wasteFactor: parseFloat(e.target.value) || 1 } : i))} style={{ width: 52, padding: "3px 5px", border: `1px solid ${hw ? C.amber : C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: hw ? C.amberPale : C.cream }} /></td><td style={{ padding: "5px 6px", fontFamily: fontMono, fontSize: 12, color: hw ? C.amber : C.textMuted }}>{rc.toFixed(3)}€</td><td style={{ padding: "5px 6px", color: C.textMuted, fontSize: 12 }}>{ing.supplier}</td><td><button onClick={() => setList(list.filter(i => i.id !== ing.id))} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 14 }}>×</button></td></tr>); })}</tbody>
        </table>
      </div>
      <div style={{ padding: 14, background: C.cream, borderRadius: 8, marginBottom: 16, border: `1px dashed ${C.border}` }}>
        <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>+ Add</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 0.6fr 1fr", gap: 6 }}>
          <input placeholder="Name" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12 }} />
          <select value={n.unit} onChange={e => setN({ ...n, unit: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12 }}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <input placeholder="Price" type="number" step="0.01" value={n.pricePerUnit} onChange={e => setN({ ...n, pricePerUnit: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12 }} />
          <input placeholder="×" type="number" step="0.01" value={n.wasteFactor} onChange={e => setN({ ...n, wasteFactor: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12 }} />
          <input placeholder="Supplier" value={n.supplier} onChange={e => setN({ ...n, supplier: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12 }} />
        </div>
        <Btn onClick={() => { if (!n.name || !n.pricePerUnit) return; setList([...list, { ...n, id: uid(), pricePerUnit: parseFloat(n.pricePerUnit), wasteFactor: parseFloat(n.wasteFactor) || 1 }]); setN({ name: "", unit: "kg", pricePerUnit: "", supplier: "", wasteFactor: "1.0" }); }} style={{ marginTop: 8 }} disabled={!n.name || !n.pricePerUnit}>Add</Btn>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={() => { onSave(list); onClose(); }}>Save</Btn></div>
    </Modal>
  );
}
function RecipeModal({ open, onClose, recipe, ingredients, onSave }) {
  const blank = { name: "", category: "Coffee", portions: 1, targetMargin: 75, sellingPrice: 0, items: [] };
  const [f, setF] = useState(recipe || blank);
  useEffect(() => { setF(recipe || blank); }, [recipe, open]);
  const tc = calcRecipeCost(f, ingredients); const uc = f.portions > 0 ? tc / f.portions : 0; const mg = getMargin(f.sellingPrice, uc);
  return (
    <Modal open={open} onClose={onClose} title={recipe?.id ? "Edit recipe" : "New recipe"}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="E.g. Flat White" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} /></label>
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Category</span><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Portions</span><input type="number" value={f.portions} onChange={e => setF({ ...f, portions: parseInt(e.target.value) || 1 })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} /></label>
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Target margin (%)</span><input type="number" value={f.targetMargin} onChange={e => setF({ ...f, targetMargin: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} /></label>
        <label style={{ display: "block", gridColumn: "1 / -1" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Selling price (€)</span><input type="number" step="0.10" value={f.sellingPrice} onChange={e => setF({ ...f, sellingPrice: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} /></label>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Ingredients</span><Btn onClick={() => setF({ ...f, items: [...f.items, { ingredientId: ingredients[0]?.id || "", qty: 0 }] })} variant="secondary" style={{ fontSize: 12, padding: "4px 12px" }}>+ Row</Btn></div>
        {f.items.map((item, idx) => { const ing = ingredients.find(i => i.id === item.ingredientId); const lc = ing ? ing.pricePerUnit * item.qty * (ing.wasteFactor || 1) : 0; return (<div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 28px", gap: 6, alignItems: "center", marginBottom: 6 }}><select value={item.ingredientId} onChange={e => { const items = [...f.items]; items[idx] = { ...items[idx], ingredientId: e.target.value }; setF({ ...f, items }); }} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12, background: C.cream }}>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select><input type="number" step="0.001" value={item.qty} onChange={e => { const items = [...f.items]; items[idx] = { ...items[idx], qty: parseFloat(e.target.value) || 0 }; setF({ ...f, items }); }} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: C.cream, width: "100%", boxSizing: "border-box" }} /><span style={{ fontFamily: fontMono, fontSize: 12, textAlign: "right", color: C.textMuted }}>{lc.toFixed(3)}€</span><button onClick={() => setF({ ...f, items: f.items.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>×</button></div>); })}
      </div>
      <div style={{ marginTop: 14, padding: 12, background: C.greenPale, borderRadius: 8, display: "flex", justifyContent: "space-around" }}><Metric label="Total cost" value={tc.toFixed(2)} size="small" /><Metric label="Cost/portion" value={uc.toFixed(2)} size="small" /><Metric label="Margin" value={f.sellingPrice > 0 ? mg.toFixed(1) : "—"} unit="%" size="small" alert={f.sellingPrice > 0 && mg < f.targetMargin} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={() => { if (!f.name) return; onSave({ ...f, id: f.id || uid() }); onClose(); }} disabled={!f.name}>Save</Btn></div>
    </Modal>
  );
}
// ─── App ────────────────────────────────────────────────────────
const SK = "estudantina-costing-v4";
export default function App() {
  const [ingredients, setIngredients] = useState(DEFAULT_INGREDIENTS);
  const [recipes, setRecipes] = useState(DEFAULT_RECIPES);
  const [filter, setFilter] = useState("All");
  const [showIngModal, setShowIngModal] = useState(false);
  const [recipeModal, setRecipeModal] = useState({ open: false, recipe: null });
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const stRef = useRef(null);
  useEffect(() => {
    (async () => {
      try { const raw = await store.get(SK); if (raw) { const d = JSON.parse(raw); if (d.ingredients?.length) setIngredients(d.ingredients); if (d.recipes?.length) setRecipes(d.recipes); } } catch (e) { console.warn(e); }
      setLoaded(true);
    })();
  }, []);
  const persist = useCallback(async () => {
    setSaveStatus("saving");
    try { await store.set(SK, JSON.stringify({ ingredients, recipes })); setSaveStatus("saved"); } catch { setSaveStatus("error"); }
    clearTimeout(stRef.current); stRef.current = setTimeout(() => setSaveStatus(null), 2000);
  }, [ingredients, recipes]);
  useEffect(() => { if (!loaded) return; const t = setTimeout(() => persist(), 500); return () => clearTimeout(t); }, [ingredients, recipes, loaded, persist]);
  const filtered = useMemo(() => { let r = recipes; if (filter !== "All") r = r.filter(x => x.category === filter); if (search) r = r.filter(x => x.name.toLowerCase().includes(search.toLowerCase())); return r; }, [recipes, filter, search]);
  const stats = useMemo(() => { let tm = 0, cp = 0, ac = 0; recipes.forEach(r => { const uc = calcUnitCost(r, ingredients); const m = getMargin(r.sellingPrice, uc); if (r.sellingPrice > 0) { tm += m; cp++; } if (m < r.targetMargin && r.sellingPrice > 0) ac++; }); return { avg: cp > 0 ? tm / cp : 0, alerts: ac, total: recipes.length }; }, [recipes, ingredients]);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: fontSans, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ background: C.green, color: "#fff", padding: "24px 24px 20px", borderBottom: "3px solid #1E3D28" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontFamily: font, fontSize: 28, fontWeight: 400, margin: 0, fontStyle: "italic" }}>Estudantina</h1>
              <span style={{ fontFamily: fontSans, fontSize: 12, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" }}>Recipe Costing</span>
              <SaveIndicator status={saveStatus} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn variant="secondary" onClick={() => { setIngredients(DEFAULT_INGREDIENTS); setRecipes(DEFAULT_RECIPES); }} style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.15)", fontSize: 11 }}>↺ Reset</Btn>
              <Btn variant="secondary" onClick={() => setShowIngModal(true)} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 12 }}>📦 Ingredients ({ingredients.length})</Btn>
              <Btn onClick={() => setRecipeModal({ open: true, recipe: null })} style={{ background: "#fff", color: C.green, fontSize: 12 }}>+ New recipe</Btn>
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, padding: 20, background: C.card, borderRadius: 10, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <Metric label="Recipes" value={stats.total} unit="" /><Metric label="Avg. margin" value={stats.avg.toFixed(1)} unit="%" /><Metric label="Alerts" value={stats.alerts} unit="" alert={stats.alerts > 0} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>{["All", ...CATEGORIES].map(c => <button key={c} onClick={() => setFilter(c)} style={{ padding: "6px 14px", borderRadius: 20, border: filter === c ? "none" : `1px solid ${C.border}`, background: filter === c ? C.green : "transparent", color: filter === c ? "#fff" : C.textMuted, fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>)}</div>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 20, fontFamily: fontSans, fontSize: 12, background: C.card, outline: "none", width: 160 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>{filtered.map(r => <RecipeCard key={r.id} recipe={r} ingredients={ingredients} onEdit={rec => setRecipeModal({ open: true, recipe: rec })} onDelete={id => setRecipes(prev => prev.filter(x => x.id !== id))} />)}</div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}><Btn onClick={() => setRecipeModal({ open: true, recipe: null })} style={{ marginTop: 12 }}>+ Create a recipe</Btn></div>}
      </div>
      <IngredientModal open={showIngModal} onClose={() => setShowIngModal(false)} ingredients={ingredients} onSave={setIngredients} />
      <RecipeModal open={recipeModal.open} onClose={() => setRecipeModal({ open: false, recipe: null })} recipe={recipeModal.recipe} ingredients={ingredients} onSave={rec => setRecipes(prev => { const idx = prev.findIndex(r => r.id === rec.id); if (idx >= 0) { const c = [...prev]; c[idx] = rec; return c; } return [...prev, rec]; })} />
    </div>
  );
}
