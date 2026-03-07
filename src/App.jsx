import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ScatterChart, Scatter, ZAxis, Legend } from "recharts";

// ─── Storage ────────────────────────────────────────────────────
const store = {
  async get(key) {
    try { if (window.storage?.get) { const r = await window.storage.get(key); return r?.value ?? null; } } catch {}
    try { return window.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  async set(key, value) {
    try { if (window.storage?.set) { await window.storage.set(key, value); return; } } catch {}
    try { window.localStorage?.setItem(key, value); } catch {}
  },
};

// ─── Theme ──────────────────────────────────────────────────────
const C = {
  bg: "#F5F0E8", card: "#FFFFFF", green: "#2D5A3D", greenLight: "#3A7550",
  greenPale: "#E8F0EA", cream: "#FAF7F0", text: "#1A1A1A", textMuted: "#6B6B6B",
  red: "#C44D4D", redPale: "#FDF0F0", amber: "#B8860B", amberPale: "#FFF8E7",
  border: "#E0DDD5", blue: "#3B6FA0", bluePale: "#EBF2F8", purple: "#6B4C9A",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 12px rgba(0,0,0,0.08)",
};
const font = "'Instrument Serif', Georgia, serif";
const fontMono = "'DM Mono', 'SF Mono', monospace";
const fontSans = "'DM Sans', 'Helvetica Neue', sans-serif";
const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_FR_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// ─── Revolut Fee Structure (in-store) ───────────────────────────
const REVOLUT_FEES = {
  "carte_eu": { pct: 0.008, fixed: 0.02, label: "Carte EU" },
  "carte_non_eu": { pct: 0.026, fixed: 0.02, label: "Carte non-EU" },
  "revolut_pay": { pct: 0.005, fixed: 0.02, label: "Revolut Pay" },
  "tap_to_pay": { pct: 0.008, fixed: 0.10, label: "Tap to Pay" },
  "especes": { pct: 0, fixed: 0, label: "Espèces" },
};
const calcFee = (amount, method) => {
  const f = REVOLUT_FEES[method] || REVOLUT_FEES.carte_eu;
  return Math.round((amount * f.pct + f.fixed) * 100) / 100;
};

// ─── Shared Components ──────────────────────────────────────────
function Badge({ children, color = C.green, bg = C.greenPale }) {
  return <span style={{ display: "inline-block", fontSize: 11, fontFamily: fontSans, fontWeight: 600, padding: "2px 8px", borderRadius: 4, color, background: bg, letterSpacing: 0.3, textTransform: "uppercase" }}>{children}</span>;
}
function Metric({ label, value, unit = "€", size = "normal", alert = false, sub }) {
  const sm = size === "small";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: fontSans, fontSize: sm ? 10 : 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: fontMono, fontSize: sm ? 18 : 26, fontWeight: 700, color: alert ? C.red : C.green, lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: sm ? 12 : 16, fontWeight: 400, color: C.textMuted }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function MarginBar({ margin, target }) {
  const barColor = margin >= target ? C.green : margin >= target - 5 ? C.amber : C.red;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted }}>Marge réelle</span>
        <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: barColor }}>{margin.toFixed(1)}%</span>
      </div>
      <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, position: "relative" }}>
        <div style={{ width: `${Math.min(margin, 100)}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.4s ease" }} />
        <div style={{ position: "absolute", left: `${target}%`, top: -2, width: 2, height: 10, background: C.text, borderRadius: 1, opacity: 0.4 }} />
      </div>
      <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, marginTop: 2 }}>Cible : {target}%</div>
    </div>
  );
}
function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 12, padding: 28, maxWidth: wide ? 800 : 560, width: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: C.shadowLg }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: font, fontSize: 22, margin: 0, color: C.green }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Btn({ children, onClick, variant = "primary", style: sx, disabled }) {
  const isPrimary = variant === "primary";
  return <button disabled={disabled} onClick={onClick} style={{ padding: "8px 18px", borderRadius: 6, border: isPrimary ? "none" : `1px solid ${C.border}`, background: isPrimary ? C.green : "transparent", color: isPrimary ? "#fff" : C.text, fontFamily: fontSans, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.2s", ...sx }}>{children}</button>;
}
function SaveIndicator({ status }) {
  if (!status) return null;
  const map = { saving: { text: "Sauvegarde…", color: C.amber }, saved: { text: "✓ Sauvegardé", color: "#8FD5A6" }, error: { text: "Erreur", color: C.red } };
  const s = map[status] || map.saved;
  return <span style={{ fontFamily: fontSans, fontSize: 11, color: s.color }}>{s.text}</span>;
}
function Card({ children, style: sx }) {
  return <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, ...sx }}>{children}</div>;
}

// ─── Costing Data ───────────────────────────────────────────────
const CATEGORIES = ["Café", "Pâtisserie", "Kombucha"];
const UNITS = ["kg", "L", "unité", "g", "mL", "cl"];
const uid = () => Math.random().toString(36).slice(2, 10);
const catColors = { "Café": { bg: "#F0E8D8", color: "#7A5C2E" }, "Pâtisserie": { bg: "#F5E8EE", color: "#8A3A5C" }, "Kombucha": { bg: "#E4F0E8", color: "#2D5A3D" } };

const calcRecipeCost = (recipe, ingredients) => {
  let total = 0;
  for (const item of recipe.items) { const ing = ingredients.find(i => i.id === item.ingredientId); if (ing) total += ing.pricePerUnit * item.qty * (ing.wasteFactor || 1); }
  return total;
};
const calcUnitCost = (recipe, ingredients) => { const t = calcRecipeCost(recipe, ingredients); return recipe.portions > 0 ? t / recipe.portions : 0; };
const getMargin = (sp, uc) => sp > 0 ? ((sp - uc) / sp) * 100 : 0;

const DEFAULT_INGREDIENTS = [
  { id: "1", name: "Café grain Olisipo", unit: "kg", pricePerUnit: 22.0, supplier: "Olisipo", wasteFactor: 1.0 },
  { id: "2", name: "Lait entier", unit: "L", pricePerUnit: 0.89, supplier: "Makro", wasteFactor: 1.03 },
  { id: "3", name: "Lait d'avoine Oatly", unit: "L", pricePerUnit: 2.49, supplier: "Makro", wasteFactor: 1.02 },
  { id: "4", name: "Sucre blanc", unit: "kg", pricePerUnit: 1.10, supplier: "Makro", wasteFactor: 1.0 },
  { id: "5", name: "Farine T55", unit: "kg", pricePerUnit: 0.85, supplier: "Makro", wasteFactor: 1.02 },
  { id: "6", name: "Beurre doux", unit: "kg", pricePerUnit: 7.50, supplier: "Makro", wasteFactor: 1.0 },
  { id: "7", name: "Oeufs (pièce)", unit: "unité", pricePerUnit: 0.18, supplier: "Makro", wasteFactor: 1.10 },
  { id: "8", name: "Chocolat noir 70%", unit: "kg", pricePerUnit: 12.50, supplier: "Makro", wasteFactor: 1.03 },
  { id: "9", name: "Crème fraîche", unit: "L", pricePerUnit: 3.20, supplier: "Makro", wasteFactor: 1.05 },
  { id: "10", name: "Thé vert (SCOBY base)", unit: "kg", pricePerUnit: 18.00, supplier: "Diverses", wasteFactor: 1.0 },
  { id: "11", name: "SCOBY / starter", unit: "L", pricePerUnit: 0.50, supplier: "Maison", wasteFactor: 1.0 },
  { id: "12", name: "Gingembre frais", unit: "kg", pricePerUnit: 5.80, supplier: "Mercado", wasteFactor: 1.15 },
  { id: "13", name: "Citron", unit: "unité", pricePerUnit: 0.25, supplier: "Mercado", wasteFactor: 1.08 },
  { id: "14", name: "Lavande séchée", unit: "g", pricePerUnit: 0.06, supplier: "Ervanária", wasteFactor: 1.0 },
  { id: "15", name: "Gobelet 12oz", unit: "unité", pricePerUnit: 0.08, supplier: "Makro", wasteFactor: 1.0 },
  { id: "16", name: "Couvercle take-away", unit: "unité", pricePerUnit: 0.03, supplier: "Makro", wasteFactor: 1.0 },
  { id: "17", name: "Bouteille kombucha 33cl", unit: "unité", pricePerUnit: 0.35, supplier: "Makro", wasteFactor: 1.0 },
  { id: "18", name: "Amande effilée", unit: "kg", pricePerUnit: 14.00, supplier: "Makro", wasteFactor: 1.05 },
  { id: "19", name: "Levure boulangère", unit: "g", pricePerUnit: 0.008, supplier: "Makro", wasteFactor: 1.0 },
  { id: "20", name: "Vanille extract", unit: "mL", pricePerUnit: 0.12, supplier: "Makro", wasteFactor: 1.0 },
  { id: "21", name: "Eau filtrée BWT", unit: "L", pricePerUnit: 0.005, supplier: "BWT", wasteFactor: 1.0 },
  { id: "22", name: "Cream cheese", unit: "kg", pricePerUnit: 6.80, supplier: "Makro", wasteFactor: 1.02 },
  { id: "23", name: "Biscuit speculoos", unit: "kg", pricePerUnit: 4.50, supplier: "Makro", wasteFactor: 1.0 },
  { id: "24", name: "Cannelle moulue", unit: "g", pricePerUnit: 0.03, supplier: "Makro", wasteFactor: 1.0 },
  { id: "25", name: "Matcha poudre", unit: "g", pricePerUnit: 0.18, supplier: "Diverses", wasteFactor: 1.0 },
  { id: "26", name: "Sirop d'érable", unit: "mL", pricePerUnit: 0.04, supplier: "Makro", wasteFactor: 1.0 },
  { id: "27", name: "Pâte feuilletée", unit: "kg", pricePerUnit: 3.20, supplier: "Makro", wasteFactor: 1.05 },
  { id: "28", name: "Confiture fruits rouges", unit: "kg", pricePerUnit: 5.50, supplier: "Mercado", wasteFactor: 1.0 },
  { id: "29", name: "Fruits frais (mix)", unit: "kg", pricePerUnit: 4.20, supplier: "Mercado", wasteFactor: 1.20 },
  { id: "30", name: "Chai concentré", unit: "L", pricePerUnit: 8.50, supplier: "Diverses", wasteFactor: 1.0 },
  { id: "31", name: "Pépites chocolat", unit: "kg", pricePerUnit: 9.00, supplier: "Makro", wasteFactor: 1.0 },
  { id: "32", name: "Cacao poudre", unit: "g", pricePerUnit: 0.02, supplier: "Makro", wasteFactor: 1.0 },
];

const DEFAULT_RECIPES = [
  // ── Cafés ──
  { id: "r1", name: "Espresso", category: "Café", portions: 1, targetMargin: 85, sellingPrice: 1.40, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "21", qty: 0.03 }] },
  { id: "r2", name: "Doppio", category: "Café", portions: 1, targetMargin: 83, sellingPrice: 2.00, items: [{ ingredientId: "1", qty: 0.036 }, { ingredientId: "21", qty: 0.06 }] },
  { id: "r3", name: "Americano", category: "Café", portions: 1, targetMargin: 82, sellingPrice: 2.50, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "21", qty: 0.20 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r4", name: "Flat White", category: "Café", portions: 1, targetMargin: 78, sellingPrice: 3.50, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.18 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r5", name: "Flat White Oat", category: "Café", portions: 1, targetMargin: 72, sellingPrice: 4.00, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "3", qty: 0.18 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r6", name: "Cappuccino", category: "Café", portions: 1, targetMargin: 78, sellingPrice: 3.20, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.15 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "32", qty: 1 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r7", name: "Cortado", category: "Café", portions: 1, targetMargin: 80, sellingPrice: 2.80, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.06 }, { ingredientId: "21", qty: 0.03 }] },
  { id: "r8", name: "Latte", category: "Café", portions: 1, targetMargin: 75, sellingPrice: 3.80, items: [{ ingredientId: "1", qty: 0.018 }, { ingredientId: "2", qty: 0.25 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r9", name: "Matcha Latte", category: "Café", portions: 1, targetMargin: 70, sellingPrice: 4.50, items: [{ ingredientId: "25", qty: 3 }, { ingredientId: "3", qty: 0.25 }, { ingredientId: "21", qty: 0.03 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  { id: "r10", name: "Chai Latte", category: "Café", portions: 1, targetMargin: 72, sellingPrice: 4.00, items: [{ ingredientId: "30", qty: 0.06 }, { ingredientId: "2", qty: 0.20 }, { ingredientId: "21", qty: 0.05 }, { ingredientId: "15", qty: 1 }, { ingredientId: "16", qty: 1 }] },
  // ── Pâtisseries ──
  { id: "r11", name: "Pastel de Nata maison", category: "Pâtisserie", portions: 12, targetMargin: 75, sellingPrice: 1.80, items: [{ ingredientId: "5", qty: 0.25 }, { ingredientId: "6", qty: 0.15 }, { ingredientId: "7", qty: 6 }, { ingredientId: "4", qty: 0.20 }, { ingredientId: "2", qty: 0.5 }, { ingredientId: "9", qty: 0.1 }, { ingredientId: "20", qty: 5 }] },
  { id: "r12", name: "Brownie chocolat", category: "Pâtisserie", portions: 16, targetMargin: 78, sellingPrice: 2.80, items: [{ ingredientId: "8", qty: 0.30 }, { ingredientId: "6", qty: 0.20 }, { ingredientId: "4", qty: 0.25 }, { ingredientId: "7", qty: 4 }, { ingredientId: "5", qty: 0.10 }] },
  { id: "r13", name: "Cheesecake", category: "Pâtisserie", portions: 10, targetMargin: 74, sellingPrice: 3.50, items: [{ ingredientId: "22", qty: 0.50 }, { ingredientId: "23", qty: 0.15 }, { ingredientId: "6", qty: 0.10 }, { ingredientId: "7", qty: 3 }, { ingredientId: "4", qty: 0.12 }, { ingredientId: "9", qty: 0.15 }, { ingredientId: "20", qty: 5 }] },
  { id: "r14", name: "Cookie pépites chocolat", category: "Pâtisserie", portions: 20, targetMargin: 80, sellingPrice: 2.20, items: [{ ingredientId: "6", qty: 0.18 }, { ingredientId: "4", qty: 0.20 }, { ingredientId: "5", qty: 0.30 }, { ingredientId: "7", qty: 2 }, { ingredientId: "31", qty: 0.15 }, { ingredientId: "20", qty: 3 }] },
  { id: "r15", name: "Croissant beurre", category: "Pâtisserie", portions: 10, targetMargin: 76, sellingPrice: 1.60, items: [{ ingredientId: "27", qty: 0.50 }, { ingredientId: "6", qty: 0.15 }, { ingredientId: "7", qty: 1 }, { ingredientId: "4", qty: 0.03 }] },
  { id: "r16", name: "Tarte fruits frais", category: "Pâtisserie", portions: 8, targetMargin: 72, sellingPrice: 3.80, items: [{ ingredientId: "27", qty: 0.25 }, { ingredientId: "9", qty: 0.20 }, { ingredientId: "4", qty: 0.10 }, { ingredientId: "7", qty: 3 }, { ingredientId: "29", qty: 0.30 }, { ingredientId: "20", qty: 3 }] },
  { id: "r17", name: "Cinnamon Roll", category: "Pâtisserie", portions: 8, targetMargin: 77, sellingPrice: 3.00, items: [{ ingredientId: "5", qty: 0.30 }, { ingredientId: "6", qty: 0.12 }, { ingredientId: "4", qty: 0.15 }, { ingredientId: "7", qty: 2 }, { ingredientId: "24", qty: 8 }, { ingredientId: "19", qty: 5 }, { ingredientId: "26", qty: 20 }] },
  // ── Kombucha ──
  { id: "r18", name: "Kombucha Gingembre-Citron", category: "Kombucha", portions: 10, targetMargin: 80, sellingPrice: 3.50, items: [{ ingredientId: "10", qty: 0.015 }, { ingredientId: "4", qty: 0.08 }, { ingredientId: "11", qty: 0.3 }, { ingredientId: "12", qty: 0.05 }, { ingredientId: "13", qty: 2 }, { ingredientId: "21", qty: 3.0 }, { ingredientId: "17", qty: 10 }] },
  { id: "r19", name: "Kombucha Lavande", category: "Kombucha", portions: 10, targetMargin: 80, sellingPrice: 3.50, items: [{ ingredientId: "10", qty: 0.015 }, { ingredientId: "4", qty: 0.08 }, { ingredientId: "11", qty: 0.3 }, { ingredientId: "14", qty: 8 }, { ingredientId: "21", qty: 3.0 }, { ingredientId: "17", qty: 10 }] },
];

const CHARGE_CATEGORIES = ["Loyer & Immo", "Énergie & Eau", "Équipement", "Personnel", "Services", "Administratif", "Autre"];

const DEFAULT_CHARGES = [
  { id: "c1", name: "Loyer local Alcântara", category: "Loyer & Immo", amount: 1200, frequency: "monthly", notes: "" },
  { id: "c2", name: "Électricité (E-REDES)", category: "Énergie & Eau", amount: 280, frequency: "monthly", notes: "Estimé post-upgrade puissance" },
  { id: "c3", name: "Eau", category: "Énergie & Eau", amount: 65, frequency: "monthly", notes: "" },
  { id: "c4", name: "Gaz", category: "Énergie & Eau", amount: 45, frequency: "monthly", notes: "" },
  { id: "c5", name: "Leasing La Marzocco Linea Classic", category: "Équipement", amount: 180, frequency: "monthly", notes: "36 mois" },
  { id: "c6", name: "Leasing Mahlkönig grinder", category: "Équipement", amount: 85, frequency: "monthly", notes: "" },
  { id: "c7", name: "Entretien BWT Bestmax", category: "Équipement", amount: 25, frequency: "monthly", notes: "Filtre ~300€/an" },
  { id: "c8", name: "Salaire employé 1", category: "Personnel", amount: 950, frequency: "monthly", notes: "Temps plein" },
  { id: "c9", name: "Salaire employé 2", category: "Personnel", amount: 760, frequency: "monthly", notes: "Temps partiel" },
  { id: "c10", name: "Charges sociales (TSU)", category: "Personnel", amount: 410, frequency: "monthly", notes: "~23.75% des salaires" },
  { id: "c11", name: "Comptabilité (Mário Moura)", category: "Services", amount: 150, frequency: "monthly", notes: "" },
  { id: "c12", name: "Assurance RC + multirisque", category: "Administratif", amount: 90, frequency: "monthly", notes: "" },
  { id: "c13", name: "Revolut Business (abo)", category: "Services", amount: 25, frequency: "monthly", notes: "" },
  { id: "c14", name: "Internet & téléphone", category: "Services", amount: 45, frequency: "monthly", notes: "" },
  { id: "c15", name: "Produits nettoyage & hygiène", category: "Autre", amount: 80, frequency: "monthly", notes: "HACCP" },
  { id: "c16", name: "Emballages & consommables", category: "Autre", amount: 120, frequency: "monthly", notes: "Gobelets, serviettes, sacs" },
  { id: "c17", name: "Marketing & com", category: "Autre", amount: 60, frequency: "monthly", notes: "Instagram, flyers" },
];

// ════════════════════════════════════════════════════════════════
// COSTING PAGE (unchanged logic, compact)
// ════════════════════════════════════════════════════════════════
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
        <div><Badge color={cc.color} bg={cc.bg}>{recipe.category}</Badge><h4 style={{ fontFamily: font, fontSize: 19, margin: "6px 0 0" }}>{recipe.name}</h4><div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>{recipe.portions > 1 ? `${recipe.portions} portions` : "1 portion"}{wc > 0 && <span style={{ marginLeft: 6, color: C.amber, fontSize: 11 }}>· {wc} avec perte</span>}</div></div>
        <div style={{ display: "flex", gap: 6 }}><button onClick={() => onEdit(recipe)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>✎</button><button onClick={() => onDelete(recipe.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.red }}>✕</button></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14, padding: "12px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Metric label="Coût/unité" value={unitCost.toFixed(2)} size="small" /><Metric label="Prix vente" value={recipe.sellingPrice.toFixed(2)} size="small" /><Metric label="Prix cible" value={suggestedPrice.toFixed(2)} size="small" alert={recipe.sellingPrice < suggestedPrice} />
      </div>
      <MarginBar margin={margin} target={recipe.targetMargin} />
      {isUnder && <div style={{ marginTop: 10, padding: "8px 10px", background: C.redPale, borderRadius: 6, fontFamily: fontSans, fontSize: 11, color: C.red }}>⚠ Prix min. suggéré : <strong>{suggestedPrice.toFixed(2)}€</strong></div>}
    </div>
  );
}

function IngredientModal({ open, onClose, ingredients, onSave }) {
  const [list, setList] = useState(ingredients);
  const [n, setN] = useState({ name: "", unit: "kg", pricePerUnit: "", supplier: "", wasteFactor: "1.0" });
  useEffect(() => { setList(ingredients); }, [ingredients]);
  return (
    <Modal open={open} onClose={onClose} title="Base ingrédients" wide>
      <div style={{ padding: "8px 12px", background: C.amberPale, borderRadius: 6, marginBottom: 14, fontFamily: fontSans, fontSize: 12, color: C.amber }}><strong>Coeff. perte</strong> : 1.00 = aucune perte. 1.10 = 10% de perte.</div>
      <div style={{ maxHeight: 350, overflow: "auto", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Ingrédient</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Prix/u</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Perte</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Coût réel</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Fourn.</th><th style={{ width: 28 }}></th></tr></thead>
          <tbody>{list.map(ing => { const rc = ing.pricePerUnit * (ing.wasteFactor || 1); const hw = (ing.wasteFactor || 1) > 1; return (<tr key={ing.id} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "5px 6px" }}>{ing.name} <span style={{ color: C.textMuted, fontSize: 11 }}>/{ing.unit}</span></td><td style={{ padding: "5px 6px" }}><input type="number" step="0.01" value={ing.pricePerUnit} onChange={e => setList(list.map(i => i.id === ing.id ? { ...i, pricePerUnit: parseFloat(e.target.value) || 0 } : i))} style={{ width: 64, padding: "3px 5px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: C.cream }} />€</td><td style={{ padding: "5px 6px" }}><input type="number" step="0.01" min="1" value={ing.wasteFactor ?? 1} onChange={e => setList(list.map(i => i.id === ing.id ? { ...i, wasteFactor: parseFloat(e.target.value) || 1 } : i))} style={{ width: 52, padding: "3px 5px", border: `1px solid ${hw ? C.amber : C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: hw ? C.amberPale : C.cream }} /></td><td style={{ padding: "5px 6px", fontFamily: fontMono, fontSize: 12, color: hw ? C.amber : C.textMuted }}>{rc.toFixed(3)}€</td><td style={{ padding: "5px 6px", color: C.textMuted, fontSize: 12 }}>{ing.supplier}</td><td><button onClick={() => setList(list.filter(i => i.id !== ing.id))} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 14 }}>×</button></td></tr>); })}</tbody>
        </table>
      </div>
      <div style={{ padding: 14, background: C.cream, borderRadius: 8, marginBottom: 16, border: `1px dashed ${C.border}` }}>
        <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>+ Ajouter</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 0.6fr 1fr", gap: 6 }}>
          <input placeholder="Nom" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12 }} />
          <select value={n.unit} onChange={e => setN({ ...n, unit: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12 }}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
          <input placeholder="Prix" type="number" step="0.01" value={n.pricePerUnit} onChange={e => setN({ ...n, pricePerUnit: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12 }} />
          <input placeholder="×" type="number" step="0.01" value={n.wasteFactor} onChange={e => setN({ ...n, wasteFactor: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12 }} />
          <input placeholder="Fournisseur" value={n.supplier} onChange={e => setN({ ...n, supplier: e.target.value })} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12 }} />
        </div>
        <Btn onClick={() => { if (!n.name || !n.pricePerUnit) return; setList([...list, { ...n, id: uid(), pricePerUnit: parseFloat(n.pricePerUnit), wasteFactor: parseFloat(n.wasteFactor) || 1 }]); setN({ name: "", unit: "kg", pricePerUnit: "", supplier: "", wasteFactor: "1.0" }); }} style={{ marginTop: 8 }} disabled={!n.name || !n.pricePerUnit}>Ajouter</Btn>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="secondary" onClick={onClose}>Annuler</Btn><Btn onClick={() => { onSave(list); onClose(); }}>Enregistrer</Btn></div>
    </Modal>
  );
}

function RecipeModal({ open, onClose, recipe, ingredients, onSave }) {
  const blank = { name: "", category: "Café", portions: 1, targetMargin: 75, sellingPrice: 0, items: [] };
  const [f, setF] = useState(recipe || blank);
  useEffect(() => { setF(recipe || blank); }, [recipe, open]);
  const tc = calcRecipeCost(f, ingredients); const uc = f.portions > 0 ? tc / f.portions : 0; const mg = getMargin(f.sellingPrice, uc);
  const inp = (label, val, onChange, props = {}) => <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>{label}</span><input value={val} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} {...props} /></label>;
  return (
    <Modal open={open} onClose={onClose} title={recipe?.id ? "Modifier" : "Nouvelle recette"}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {inp("Nom", f.name, v => setF({ ...f, name: v }), { placeholder: "Ex: Flat White" })}
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Catégorie</span><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        {inp("Portions", f.portions, v => setF({ ...f, portions: parseInt(v) || 1 }), { type: "number" })}
        {inp("Marge cible (%)", f.targetMargin, v => setF({ ...f, targetMargin: parseFloat(v) || 0 }), { type: "number" })}
        <label style={{ display: "block", gridColumn: "1 / -1" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Prix de vente (€)</span><input type="number" step="0.10" value={f.sellingPrice} onChange={e => setF({ ...f, sellingPrice: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} /></label>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Ingrédients</span><Btn onClick={() => setF({ ...f, items: [...f.items, { ingredientId: ingredients[0]?.id || "", qty: 0 }] })} variant="secondary" style={{ fontSize: 12, padding: "4px 12px" }}>+ Ligne</Btn></div>
        {f.items.map((item, idx) => { const ing = ingredients.find(i => i.id === item.ingredientId); const lc = ing ? ing.pricePerUnit * item.qty * (ing.wasteFactor || 1) : 0; return (<div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 28px", gap: 6, alignItems: "center", marginBottom: 6 }}><select value={item.ingredientId} onChange={e => { const items = [...f.items]; items[idx] = { ...items[idx], ingredientId: e.target.value }; setF({ ...f, items }); }} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12, background: C.cream }}>{ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select><input type="number" step="0.001" value={item.qty} onChange={e => { const items = [...f.items]; items[idx] = { ...items[idx], qty: parseFloat(e.target.value) || 0 }; setF({ ...f, items }); }} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: C.cream, width: "100%", boxSizing: "border-box" }} /><span style={{ fontFamily: fontMono, fontSize: 12, textAlign: "right", color: C.textMuted }}>{lc.toFixed(3)}€</span><button onClick={() => setF({ ...f, items: f.items.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>×</button></div>); })}
      </div>
      <div style={{ marginTop: 14, padding: 12, background: C.greenPale, borderRadius: 8, display: "flex", justifyContent: "space-around" }}><Metric label="Coût total" value={tc.toFixed(2)} size="small" /><Metric label="Coût/portion" value={uc.toFixed(2)} size="small" /><Metric label="Marge" value={f.sellingPrice > 0 ? mg.toFixed(1) : "—"} unit="%" size="small" alert={f.sellingPrice > 0 && mg < f.targetMargin} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><Btn variant="secondary" onClick={onClose}>Annuler</Btn><Btn onClick={() => { if (!f.name) return; onSave({ ...f, id: f.id || uid() }); onClose(); }} disabled={!f.name}>Enregistrer</Btn></div>
    </Modal>
  );
}

function CostingPage({ ingredients, setIngredients, recipes, setRecipes }) {
  const [filter, setFilter] = useState("Tous");
  const [showIngModal, setShowIngModal] = useState(false);
  const [recipeModal, setRecipeModal] = useState({ open: false, recipe: null });
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => { let r = recipes; if (filter !== "Tous") r = r.filter(x => x.category === filter); if (search) r = r.filter(x => x.name.toLowerCase().includes(search.toLowerCase())); return r; }, [recipes, filter, search]);
  const stats = useMemo(() => { let tm = 0, cp = 0, ac = 0; recipes.forEach(r => { const uc = calcUnitCost(r, ingredients); const m = getMargin(r.sellingPrice, uc); if (r.sellingPrice > 0) { tm += m; cp++; } if (m < r.targetMargin && r.sellingPrice > 0) ac++; }); return { avg: cp > 0 ? tm / cp : 0, alerts: ac, total: recipes.length }; }, [recipes, ingredients]);

  return (<>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <Btn variant="secondary" onClick={() => { setIngredients(DEFAULT_INGREDIENTS); setRecipes(DEFAULT_RECIPES); }} style={{ fontSize: 11, color: C.textMuted }}>↺ Reset</Btn>
      <Btn variant="secondary" onClick={() => setShowIngModal(true)} style={{ fontSize: 12 }}>📦 Ingrédients ({ingredients.length})</Btn>
      <Btn onClick={() => setRecipeModal({ open: true, recipe: null })} style={{ fontSize: 12 }}>+ Nouvelle recette</Btn>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, padding: 20, background: C.card, borderRadius: 10, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
      <Metric label="Recettes" value={stats.total} unit="" /><Metric label="Marge moy." value={stats.avg.toFixed(1)} unit="%" /><Metric label="Alertes" value={stats.alerts} unit="" alert={stats.alerts > 0} />
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>{["Tous", ...CATEGORIES].map(c => <button key={c} onClick={() => setFilter(c)} style={{ padding: "6px 14px", borderRadius: 20, border: filter === c ? "none" : `1px solid ${C.border}`, background: filter === c ? C.green : "transparent", color: filter === c ? "#fff" : C.textMuted, fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>)}</div>
      <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 20, fontFamily: fontSans, fontSize: 12, background: C.card, outline: "none", width: 160 }} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>{filtered.map(r => <RecipeCard key={r.id} recipe={r} ingredients={ingredients} onEdit={rec => setRecipeModal({ open: true, recipe: rec })} onDelete={id => setRecipes(prev => prev.filter(x => x.id !== id))} />)}</div>
    <IngredientModal open={showIngModal} onClose={() => setShowIngModal(false)} ingredients={ingredients} onSave={setIngredients} />
    <RecipeModal open={recipeModal.open} onClose={() => setRecipeModal({ open: false, recipe: null })} recipe={recipeModal.recipe} ingredients={ingredients} onSave={rec => setRecipes(prev => { const idx = prev.findIndex(r => r.id === rec.id); if (idx >= 0) { const c = [...prev]; c[idx] = rec; return c; } return [...prev, rec]; })} />
  </>);
}

// ════════════════════════════════════════════════════════════════
// SALES PAGE — Product-level analytics
// ════════════════════════════════════════════════════════════════

const PAYMENT_METHODS = Object.keys(REVOLUT_FEES);

function generateDemoSales(recipes, ingredients) {
  const sales = [];
  const base = new Date(2026, 6, 7); // July 7 2026
  const hourW = [0, 0, 0, 0, 0, 0, 0, 1, 8, 14, 11, 9, 5, 4, 6, 10, 8, 5, 2, 0, 0, 0, 0, 0];
  // Realistic Lisbon café payment split: 60% carte EU, 15% Revolut Pay, 15% espèces, 8% carte non-EU, 2% tap to pay
  const methodPool = [
    ...Array(12).fill("carte_eu"),
    ...Array(3).fill("revolut_pay"),
    ...Array(3).fill("especes"),
    ...Array(2).fill("carte_non_eu"),
  ];

  // Product popularity weights (café-heavy, pastry supporting)
  const productWeights = recipes.map(r => {
    const w = {
      "Espresso": 12, "Doppio": 4, "Americano": 6, "Flat White": 14, "Flat White Oat": 10,
      "Cappuccino": 11, "Cortado": 5, "Latte": 8, "Matcha Latte": 4, "Chai Latte": 3,
      "Pastel de Nata maison": 15, "Brownie chocolat": 6, "Cheesecake": 4, "Cookie pépites chocolat": 8,
      "Croissant beurre": 12, "Tarte fruits frais": 3, "Cinnamon Roll": 5,
      "Kombucha Gingembre-Citron": 4, "Kombucha Lavande": 3,
    };
    return w[r.name] || 3;
  });
  const totalWeight = productWeights.reduce((a, b) => a + b, 0);

  // Calculate average product price to calibrate txn count for 400€/day
  const avgPrice = recipes.reduce((s, r) => s + r.sellingPrice, 0) / recipes.length;

  for (let day = 0; day < 7; day++) {
    const d = new Date(base); d.setDate(d.getDate() + day);
    const dow = d.getDay();
    // Day multipliers: Mon=0.8, Tue-Thu=1.0, Fri=1.15, Sat=1.35, Sun=0.7
    const mult = [0.7, 0.8, 1.0, 1.0, 1.0, 1.15, 1.35][dow];
    const targetCA = 400 * mult;
    // Estimate txns needed: avg 1.3 products per txn
    const estTxns = Math.round(targetCA / (avgPrice * 1.3));
    let dayTotal = 0;

    for (let t = 0; t < estTxns && dayTotal < targetCA * 1.15; t++) {
      // Pick hour
      let hr = Math.random() * hourW.reduce((a, b) => a + b, 0); let hour = 8;
      for (let h = 0; h < 24; h++) { hr -= hourW[h]; if (hr <= 0) { hour = h; break; } }
      const txDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, Math.floor(Math.random() * 60));

      // 1-3 products per transaction (40% get 2, 8% get 3)
      const numProducts = Math.random() < 0.08 ? 3 : Math.random() < 0.45 ? 2 : 1;
      const items = [];
      for (let p = 0; p < numProducts; p++) {
        let roll = Math.random() * totalWeight; let idx = 0;
        for (let i = 0; i < recipes.length; i++) { roll -= productWeights[i]; if (roll <= 0) { idx = i; break; } }
        const recipe = recipes[idx];
        const existing = items.find(i => i.productName === recipe.name);
        if (existing) existing.qty++;
        else items.push({ productName: recipe.name, recipeId: recipe.id, qty: 1, unitPrice: recipe.sellingPrice, snapshotCost: calcUnitCost(recipe, ingredients) });
      }

      const totalAmount = Math.round(items.reduce((s, i) => s + i.qty * i.unitPrice, 0) * 100) / 100;
      const method = methodPool[Math.floor(Math.random() * methodPool.length)];
      const fee = calcFee(totalAmount, method);
      dayTotal += totalAmount;

      sales.push({ id: uid(), date: txDate, items, totalAmount, paymentMethod: method, fee, net: Math.round((totalAmount - fee) * 100) / 100 });
    }
  }
  return sales.sort((a, b) => a.date - b.date);
}

// Menu Engineering classification
function classifyProduct(popularity, profitability, avgPop, avgProf) {
  if (popularity >= avgPop && profitability >= avgProf) return { label: "⭐ Star", color: C.green, desc: "Populaire & rentable" };
  if (popularity < avgPop && profitability >= avgProf) return { label: "🧩 Puzzle", color: C.blue, desc: "Rentable mais peu vendu" };
  if (popularity >= avgPop && profitability < avgProf) return { label: "🐴 Cheval", color: C.amber, desc: "Populaire mais marge faible" };
  return { label: "🐕 Chien", color: C.red, desc: "Ni populaire ni rentable" };
}

function SalesPage({ sales, setSales, recipes, ingredients }) {
  const fileRef = useRef(null);
  const [period, setPeriod] = useState("all");
  const [dailyModal, setDailyModal] = useState(false);
  const [dailyEntry, setDailyEntry] = useState({ date: new Date().toISOString().split("T")[0], method: "carte_eu", items: {} });
  const [sim, setSim] = useState({ clients: "", ticket: "", openDays: 26, marginPct: "" });

  const filteredSales = useMemo(() => {
    if (period === "all" || sales.length === 0) return sales;
    const last = sales[sales.length - 1]?.date || new Date();
    const cutoff = new Date(last);
    if (period === "7d") cutoff.setDate(cutoff.getDate() - 7);
    else if (period === "14d") cutoff.setDate(cutoff.getDate() - 14);
    else if (period === "30d") cutoff.setDate(cutoff.getDate() - 30);
    return sales.filter(s => s.date >= cutoff);
  }, [sales, period]);

  // Full analytics
  const analytics = useMemo(() => {
    if (filteredSales.length === 0) return null;

    const totalGross = filteredSales.reduce((s, t) => s + t.totalAmount, 0);
    const totalFees = filteredSales.reduce((s, t) => s + t.fee, 0);
    const totalNet = totalGross - totalFees;
    const avgTicket = totalGross / filteredSales.length;

    // By day
    const byDay = {};
    filteredSales.forEach(t => { const k = t.date.toISOString().split("T")[0]; if (!byDay[k]) byDay[k] = { date: k, gross: 0, fees: 0, count: 0, net: 0 }; byDay[k].gross += t.totalAmount; byDay[k].fees += t.fee; byDay[k].net += t.net; byDay[k].count++; });
    const dailyData = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    const dayCount = dailyData.length;
    const avgDailyCA = dayCount > 0 ? totalGross / dayCount : 0;

    // By hour
    const byHour = Array(24).fill(0).map((_, h) => ({ hour: h, label: `${h}h`, count: 0, gross: 0 }));
    filteredSales.forEach(t => { const h = t.date.getHours(); byHour[h].count++; byHour[h].gross += t.totalAmount; });
    const peakHour = byHour.reduce((max, h) => h.gross > max.gross ? h : max, byHour[0]);
    const activeHours = byHour.filter(h => h.count > 0);

    // By DOW
    const byDow = Array(7).fill(0).map((_, d) => ({ dow: d, label: DAYS_FR[d], gross: 0, days: new Set() }));
    filteredSales.forEach(t => { const dow = t.date.getDay(); byDow[dow].gross += t.totalAmount; byDow[dow].days.add(t.date.toISOString().split("T")[0]); });
    const dowData = [...byDow.slice(1), byDow[0]].map(d => ({ ...d, days: d.days.size, avgGross: d.days.size > 0 ? d.gross / d.days.size : 0 }));

    // By payment method
    const byMethod = {};
    filteredSales.forEach(t => { const m = t.paymentMethod || "carte_eu"; if (!byMethod[m]) byMethod[m] = { method: m, label: REVOLUT_FEES[m]?.label || m, count: 0, gross: 0, fees: 0 }; byMethod[m].count++; byMethod[m].gross += t.totalAmount; byMethod[m].fees += t.fee; });
    const methodData = Object.values(byMethod).sort((a, b) => b.gross - a.gross);

    // ── Product Mix ──
    const byProduct = {};
    filteredSales.forEach(t => {
      t.items?.forEach(item => {
        const name = item.productName;
        if (!byProduct[name]) byProduct[name] = { name, recipeId: item.recipeId, qty: 0, revenue: 0, unitPrice: item.unitPrice, totalSnapshotCost: 0, hasSnapshot: false };
        byProduct[name].qty += item.qty;
        byProduct[name].revenue += item.qty * item.unitPrice;
        if (item.snapshotCost != null) {
          byProduct[name].totalSnapshotCost += item.snapshotCost * item.qty;
          byProduct[name].hasSnapshot = true;
        }
      });
    });
    const productData = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue);

    // Cross with costing for P&L — use snapshot cost when available
    const productPL = productData.map(p => {
      const recipe = recipes.find(r => r.id === p.recipeId || r.name === p.name);
      const currentUnitCost = recipe ? calcUnitCost(recipe, ingredients) : 0;
      // Use snapshotted cost if available, otherwise fall back to current
      const totalCost = p.hasSnapshot ? p.totalSnapshotCost : currentUnitCost * p.qty;
      const avgUnitCost = p.qty > 0 ? totalCost / p.qty : 0;
      const margin = p.unitPrice > 0 ? getMargin(p.unitPrice, avgUnitCost) : 0;
      const totalProfit = p.revenue - totalCost;
      return { ...p, unitCost: avgUnitCost, currentUnitCost, margin, totalCost, totalProfit, category: recipe?.category || "?" };
    });

    // Menu Engineering
    const avgQty = productPL.length > 0 ? productPL.reduce((s, p) => s + p.qty, 0) / productPL.length : 0;
    const avgMarginVal = productPL.length > 0 ? productPL.reduce((s, p) => s + p.margin, 0) / productPL.length : 0;
    const menuEngineering = productPL.map(p => ({
      ...p,
      classification: classifyProduct(p.qty, p.margin, avgQty, avgMarginVal),
    }));

    // Ticket distribution
    const brackets = [{ label: "< 2€", min: 0, max: 2, count: 0 }, { label: "2-4€", min: 2, max: 4, count: 0 }, { label: "4-6€", min: 4, max: 6, count: 0 }, { label: "6-10€", min: 6, max: 10, count: 0 }, { label: "10€+", min: 10, max: 999, count: 0 }];
    filteredSales.forEach(t => { const b = brackets.find(br => t.totalAmount >= br.min && t.totalAmount < br.max); if (b) b.count++; });

    return { totalGross, totalFees, totalNet, avgTicket, avgDailyCA, dayCount, txnCount: filteredSales.length, dailyData, activeHours, peakHour, dowData, methodData, productPL, menuEngineering, brackets, feeRate: totalGross > 0 ? totalFees / totalGross * 100 : 0, avgQty, avgMarginVal };
  }, [filteredSales, recipes, ingredients]);

  // Daily quick entry
  const submitDailyEntry = () => {
    const entries = Object.entries(dailyEntry.items).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return;
    const d = new Date(dailyEntry.date + "T12:00:00");
    const items = entries.map(([recipeId, qty]) => {
      const recipe = recipes.find(r => r.id === recipeId);
      return { productName: recipe?.name || "?", recipeId, qty: parseInt(qty), unitPrice: recipe?.sellingPrice || 0, snapshotCost: recipe ? calcUnitCost(recipe, ingredients) : 0 };
    });
    const totalAmount = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const fee = calcFee(totalAmount, dailyEntry.method);
    setSales(prev => [...prev, { id: uid(), date: d, items, totalAmount, paymentMethod: dailyEntry.method, fee, net: totalAmount - fee }].sort((a, b) => a.date - b.date));
    setDailyEntry({ date: new Date().toISOString().split("T")[0], method: "carte_eu", items: {} });
    setDailyModal(false);
  };

  const hasData = sales.length > 0;

  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {[{ k: "all", l: "Tout" }, { k: "7d", l: "7j" }, { k: "30d", l: "30j" }].map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)} style={{ padding: "6px 14px", borderRadius: 20, border: period === p.k ? "none" : `1px solid ${C.border}`, background: period === p.k ? C.green : "transparent", color: period === p.k ? "#fff" : C.textMuted, fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{p.l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="secondary" onClick={() => setDailyModal(true)} style={{ fontSize: 12 }}>📝 Saisie rapide</Btn>
        <Btn variant="secondary" onClick={() => setSales(generateDemoSales(recipes, ingredients))} style={{ fontSize: 11, color: C.textMuted }}>Démo 7j (~400€/j)</Btn>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={() => {}} />
        <Btn onClick={() => fileRef.current?.click()} style={{ fontSize: 12 }}>📤 Import CSV</Btn>
      </div>
    </div>

    {!hasData ? (
      <Card style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontFamily: font, fontSize: 24, color: C.green, marginBottom: 8 }}>Pas encore de données</div>
        <div style={{ fontFamily: fontSans, fontSize: 14, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>Importe ton CSV Revolut ou utilise la saisie rapide pour entrer tes ventes du jour.<br />Ou charge les données démo pour explorer le dashboard.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn onClick={() => setSales(generateDemoSales(recipes, ingredients))}>Charger démo (7 jours)</Btn>
          <Btn variant="secondary" onClick={() => setDailyModal(true)}>📝 Saisie rapide</Btn>
        </div>
      </Card>
    ) : analytics && (<>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Card><Metric label="CA Brut" value={analytics.totalGross.toFixed(0)} sub={`${analytics.dayCount} jours`} /></Card>
        <Card><Metric label="CA Net" value={analytics.totalNet.toFixed(0)} sub={`-${analytics.totalFees.toFixed(0)}€ frais`} /></Card>
        <Card><Metric label="Frais Revolut" value={`${analytics.feeRate.toFixed(2)}`} unit="%" alert={analytics.feeRate > 1.5} /></Card>
        <Card><Metric label="Transactions" value={analytics.txnCount} unit="" sub={`${(analytics.txnCount / analytics.dayCount).toFixed(0)}/jour`} /></Card>
        <Card><Metric label="Ticket moyen" value={analytics.avgTicket.toFixed(2)} /></Card>
        <Card><Metric label="CA moy./jour" value={analytics.avgDailyCA.toFixed(0)} /></Card>
      </div>

      {/* Daily CA */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>CA journalier</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={analytics.dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tickFormatter={d => { const dt = new Date(d); return `${DAYS_FR[dt.getDay()]} ${dt.getDate()}`; }} style={{ fontFamily: fontSans, fontSize: 10 }} />
            <YAxis style={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `${v}€`} />
            <Tooltip formatter={v => [`${v.toFixed(2)}€`]} labelFormatter={d => { const dt = new Date(d); return `${DAYS_FR_FULL[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}`; }} contentStyle={{ fontFamily: fontSans, fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="gross" name="CA" radius={[4, 4, 0, 0]} fill={C.green} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Product Mix + P&L */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>P&L par produit</div>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Produit</th>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>Qtés</th>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>CA</th>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>Coût mat.</th>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>Profit</th>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase", textAlign: "right" }}>Marge</th>
            </tr></thead>
            <tbody>
              {analytics.productPL.map(p => {
                const cc = catColors[p.category] || {};
                return (<tr key={p.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px" }}><Badge color={cc.color} bg={cc.bg}>{p.category}</Badge> <span style={{ marginLeft: 4 }}>{p.name}</span></td>
                  <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right" }}>{p.qty}</td>
                  <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right" }}>{p.revenue.toFixed(0)}€</td>
                  <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right", color: C.red }}>{p.totalCost.toFixed(0)}€</td>
                  <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right", color: C.green, fontWeight: 600 }}>{p.totalProfit.toFixed(0)}€</td>
                  <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right" }}><span style={{ padding: "2px 6px", borderRadius: 4, background: p.margin >= 75 ? C.greenPale : p.margin >= 60 ? C.amberPale : C.redPale, color: p.margin >= 75 ? C.green : p.margin >= 60 ? C.amber : C.red, fontSize: 11, fontWeight: 600 }}>{p.margin.toFixed(1)}%</span></td>
                </tr>);
              })}
              <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                <td style={{ padding: 6 }}>TOTAL</td>
                <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right" }}>{analytics.productPL.reduce((s, p) => s + p.qty, 0)}</td>
                <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right" }}>{analytics.productPL.reduce((s, p) => s + p.revenue, 0).toFixed(0)}€</td>
                <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right", color: C.red }}>{analytics.productPL.reduce((s, p) => s + p.totalCost, 0).toFixed(0)}€</td>
                <td style={{ padding: 6, fontFamily: fontMono, textAlign: "right", color: C.green }}>{analytics.productPL.reduce((s, p) => s + p.totalProfit, 0).toFixed(0)}€</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Menu Engineering */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Menu Engineering</div>
        <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 16 }}>Popularité (quantités vendues) × Rentabilité (marge %)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {analytics.menuEngineering.map(p => (
            <div key={p.name} style={{ padding: 12, borderRadius: 8, border: `1px solid ${p.classification.color}25`, background: `${p.classification.color}08` }}>
              <div style={{ fontFamily: fontSans, fontSize: 11, color: p.classification.color, fontWeight: 600, marginBottom: 4 }}>{p.classification.label}</div>
              <div style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>
                {p.qty} vendus · {p.margin.toFixed(0)}% marge · {p.totalProfit.toFixed(0)}€ profit
              </div>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, marginTop: 4, fontStyle: "italic" }}>{p.classification.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Hourly */}
        <Card>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Répartition horaire <span style={{ fontWeight: 400, color: C.textMuted, fontSize: 11 }}>Pic : {analytics.peakHour.hour}h</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.activeHours}>
              <XAxis dataKey="label" style={{ fontFamily: fontSans, fontSize: 10 }} />
              <YAxis style={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `${v}€`} />
              <Tooltip formatter={v => [`${v.toFixed(0)}€`]} contentStyle={{ fontFamily: fontSans, fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="gross" name="CA" radius={[3, 3, 0, 0]}>{analytics.activeHours.map((h, i) => <Cell key={i} fill={h.hour === analytics.peakHour.hour ? C.amber : C.blue} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* DOW */}
        <Card>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>CA moyen par jour</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.dowData}>
              <XAxis dataKey="label" style={{ fontFamily: fontSans, fontSize: 11 }} />
              <YAxis style={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `${v}€`} />
              <Tooltip formatter={v => [`${v.toFixed(0)}€`]} contentStyle={{ fontFamily: fontSans, fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="avgGross" name="CA moy." radius={[3, 3, 0, 0]}>{analytics.dowData.map((d, i) => { const mx = Math.max(...analytics.dowData.map(x => x.avgGross)); return <Cell key={i} fill={d.avgGross === mx ? C.green : C.greenLight + "80"} />; })}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Payment methods */}
        <Card>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Répartition paiements</div>
          {analytics.methodData.map(m => {
            const pct = analytics.totalGross > 0 ? (m.gross / analytics.totalGross * 100) : 0;
            const feeRate = m.gross > 0 ? (m.fees / m.gross * 100) : 0;
            return (<div key={m.method} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div><div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 500 }}>{m.label}</div><div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted }}>{m.count} txns · {pct.toFixed(0)}% du CA</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 600 }}>{m.gross.toFixed(0)}€</div><div style={{ fontFamily: fontMono, fontSize: 11, color: C.red }}>-{m.fees.toFixed(2)}€ ({feeRate.toFixed(2)}%)</div></div>
            </div>);
          })}
        </Card>

        {/* Ticket distribution */}
        <Card>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Distribution des tickets</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.brackets}>
              <XAxis dataKey="label" style={{ fontFamily: fontSans, fontSize: 11 }} />
              <YAxis style={{ fontFamily: fontMono, fontSize: 10 }} />
              <Tooltip contentStyle={{ fontFamily: fontSans, fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="Txns" radius={[3, 3, 0, 0]} fill={C.blue} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>)}

    {/* ── Revenue Simulator ── */}
    <Card style={{ marginTop: 16, marginBottom: 16, border: `1px solid ${C.blue}30` }}>
      <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>🔮 Simulateur de revenus</div>
      <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
        Projette ton CA et ta rentabilité en ajustant les paramètres. Les valeurs actuelles sont pré-remplies depuis tes données.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4 }}>Clients / jour</span>
          <input type="number" min="0" placeholder={analytics ? analytics.txnCount / analytics.dayCount < 1 ? "0" : (analytics.txnCount / analytics.dayCount).toFixed(0) : "60"} value={sim.clients} onChange={e => setSim({ ...sim, clients: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.blue}40`, borderRadius: 6, fontFamily: fontMono, fontSize: 16, background: C.bluePale, boxSizing: "border-box", textAlign: "center" }} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4 }}>Panier moyen (€)</span>
          <input type="number" step="0.10" min="0" placeholder={analytics ? analytics.avgTicket.toFixed(2) : "5.50"} value={sim.ticket} onChange={e => setSim({ ...sim, ticket: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.blue}40`, borderRadius: 6, fontFamily: fontMono, fontSize: 16, background: C.bluePale, boxSizing: "border-box", textAlign: "center" }} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4 }}>Jours ouverts / mois</span>
          <input type="number" min="1" max="31" value={sim.openDays} onChange={e => setSim({ ...sim, openDays: parseInt(e.target.value) || 26 })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.blue}40`, borderRadius: 6, fontFamily: fontMono, fontSize: 16, background: C.bluePale, boxSizing: "border-box", textAlign: "center" }} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4 }}>Marge brute (%)</span>
          <input type="number" step="1" min="0" max="100" placeholder={analytics ? ((1 - analytics.productPL.reduce((s, p) => s + p.totalCost, 0) / analytics.productPL.reduce((s, p) => s + p.revenue, 0)) * 100).toFixed(0) : "72"} value={sim.marginPct} onChange={e => setSim({ ...sim, marginPct: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.blue}40`, borderRadius: 6, fontFamily: fontMono, fontSize: 16, background: C.bluePale, boxSizing: "border-box", textAlign: "center" }} />
        </label>
      </div>

      {(() => {
        const sClients = parseFloat(sim.clients) || (analytics ? analytics.txnCount / analytics.dayCount : 60);
        const sTicket = parseFloat(sim.ticket) || (analytics ? analytics.avgTicket : 5.50);
        const sOpenDays = sim.openDays || 26;
        const sMargin = (parseFloat(sim.marginPct) || (analytics ? (1 - analytics.productPL.reduce((s, p) => s + p.totalCost, 0) / Math.max(analytics.productPL.reduce((s, p) => s + p.revenue, 0), 1)) * 100 : 72)) / 100;
        const sFeeRate = analytics ? analytics.feeRate / 100 : 0.008;

        const simDailyCA = sClients * sTicket;
        const simMonthlyCA = simDailyCA * sOpenDays;
        const simMonthlyCOGS = simMonthlyCA * (1 - sMargin);
        const simMonthlyFees = simMonthlyCA * sFeeRate;
        const simMonthlyMargin = simMonthlyCA - simMonthlyCOGS - simMonthlyFees;
        const simYearlyCA = simMonthlyCA * 12;

        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <div style={{ textAlign: "center", padding: 12, background: C.bluePale, borderRadius: 8 }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>CA / jour</div>
              <div style={{ fontFamily: fontMono, fontSize: 22, fontWeight: 700, color: C.blue }}>{simDailyCA.toFixed(0)}<span style={{ fontSize: 14, color: C.textMuted }}>€</span></div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: C.bluePale, borderRadius: 8 }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>CA / mois</div>
              <div style={{ fontFamily: fontMono, fontSize: 22, fontWeight: 700, color: C.blue }}>{(simMonthlyCA / 1000).toFixed(1)}<span style={{ fontSize: 14, color: C.textMuted }}>k€</span></div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: C.bluePale, borderRadius: 8 }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>Marge brute / mois</div>
              <div style={{ fontFamily: fontMono, fontSize: 22, fontWeight: 700, color: C.green }}>{simMonthlyMargin.toFixed(0)}<span style={{ fontSize: 14, color: C.textMuted }}>€</span></div>
            </div>
            <div style={{ textAlign: "center", padding: 12, background: C.bluePale, borderRadius: 8 }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>CA / an</div>
              <div style={{ fontFamily: fontMono, fontSize: 22, fontWeight: 700, color: C.blue }}>{(simYearlyCA / 1000).toFixed(0)}<span style={{ fontSize: 14, color: C.textMuted }}>k€</span></div>
            </div>
          </div>
        );
      })()}

      {/* Sensitivity table */}
      {(() => {
        const baseClients = parseFloat(sim.clients) || (analytics ? analytics.txnCount / analytics.dayCount : 60);
        const baseTicket = parseFloat(sim.ticket) || (analytics ? analytics.avgTicket : 5.50);
        const sOpenDays = sim.openDays || 26;
        const sMargin = (parseFloat(sim.marginPct) || (analytics ? (1 - analytics.productPL.reduce((s, p) => s + p.totalCost, 0) / Math.max(analytics.productPL.reduce((s, p) => s + p.revenue, 0), 1)) * 100 : 72)) / 100;

        const clientVariations = [-20, -10, 0, 10, 20];
        const ticketVariations = [-1.0, -0.5, 0, 0.5, 1.0];

        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Sensibilité : CA mensuel selon clients/jour et panier moyen
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontMono, fontSize: 11, textAlign: "center" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 6, background: C.cream, borderRadius: "6px 0 0 0", fontFamily: fontSans, fontSize: 10, color: C.textMuted }}>Clients ↓ / Panier →</th>
                    {ticketVariations.map(tv => (
                      <th key={tv} style={{ padding: 6, background: C.cream, fontFamily: fontMono, fontSize: 11, color: tv === 0 ? C.blue : C.textMuted }}>
                        {(baseTicket + tv).toFixed(1)}€
                        {tv !== 0 && <span style={{ fontSize: 9, color: C.textMuted }}> ({tv > 0 ? "+" : ""}{tv.toFixed(1)})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientVariations.map(cv => {
                    const clients = Math.max(1, Math.round(baseClients + cv));
                    return (
                      <tr key={cv}>
                        <td style={{ padding: 6, fontFamily: fontSans, fontSize: 11, fontWeight: cv === 0 ? 600 : 400, color: cv === 0 ? C.blue : C.textMuted, background: C.cream }}>
                          {clients}/j {cv !== 0 && <span style={{ fontSize: 9 }}>({cv > 0 ? "+" : ""}{cv})</span>}
                        </td>
                        {ticketVariations.map(tv => {
                          const ticket = baseTicket + tv;
                          const ca = clients * ticket * sOpenDays;
                          const margin = ca * sMargin;
                          const isBase = cv === 0 && tv === 0;
                          return (
                            <td key={tv} style={{
                              padding: 6, fontWeight: isBase ? 700 : 400,
                              color: isBase ? C.blue : C.text,
                              background: isBase ? C.bluePale : "transparent",
                              borderRadius: isBase ? 4 : 0,
                              border: `1px solid ${C.border}22`,
                            }}>
                              {(ca / 1000).toFixed(1)}k
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {sim.clients || sim.ticket || sim.marginPct ? (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button onClick={() => setSim({ clients: "", ticket: "", openDays: 26, marginPct: "" })} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 12px", fontFamily: fontSans, fontSize: 11, cursor: "pointer", color: C.textMuted }}>Reset aux valeurs réelles</button>
        </div>
      ) : null}
    </Card>

    {/* Daily quick entry modal */}
    <Modal open={dailyModal} onClose={() => setDailyModal(false)} title="Saisie rapide du jour" wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Date</span><input type="date" value={dailyEntry.date} onChange={e => setDailyEntry({ ...dailyEntry, date: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} /></label>
        <label style={{ display: "block" }}><span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Paiement dominant</span><select value={dailyEntry.method} onChange={e => setDailyEntry({ ...dailyEntry, method: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream }}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{REVOLUT_FEES[m].label}</option>)}</select></label>
      </div>
      <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Quantités vendues</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {recipes.map(r => {
          const cc = catColors[r.category] || {};
          return (<div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: (dailyEntry.items[r.id] || 0) > 0 ? C.greenPale : C.cream }}>
            <div style={{ flex: 1 }}><Badge color={cc.color} bg={cc.bg}>{r.category}</Badge><div style={{ fontFamily: fontSans, fontSize: 13, marginTop: 2 }}>{r.name}</div><div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>{r.sellingPrice.toFixed(2)}€</div></div>
            <input type="number" min="0" value={dailyEntry.items[r.id] || ""} placeholder="0" onChange={e => setDailyEntry({ ...dailyEntry, items: { ...dailyEntry.items, [r.id]: parseInt(e.target.value) || 0 } })} style={{ width: 56, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontMono, fontSize: 16, textAlign: "center", background: C.card }} />
          </div>);
        })}
      </div>
      {(() => { const total = Object.entries(dailyEntry.items).reduce((s, [rid, qty]) => { const r = recipes.find(x => x.id === rid); return s + (r?.sellingPrice || 0) * (qty || 0); }, 0); return total > 0 ? <div style={{ marginTop: 12, padding: 12, background: C.greenPale, borderRadius: 8, display: "flex", justifyContent: "space-around" }}><Metric label="CA estimé" value={total.toFixed(2)} size="small" /><Metric label="Frais estimés" value={calcFee(total, dailyEntry.method).toFixed(2)} size="small" alert /></div> : null; })()}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><Btn variant="secondary" onClick={() => setDailyModal(false)}>Annuler</Btn><Btn onClick={submitDailyEntry}>Enregistrer</Btn></div>
    </Modal>
  </>);
}

// ════════════════════════════════════════════════════════════════
// PAGE 3: CHARGES FIXES & TRÉSORERIE
// ════════════════════════════════════════════════════════════════

function ChargesPage({ charges, setCharges, sales, ingredients, recipes }) {
  const [editModal, setEditModal] = useState({ open: false, charge: null });
  const [showForm, setShowForm] = useState(false);
  const [newCharge, setNewCharge] = useState({ name: "", category: "Loyer & Immo", amount: "", frequency: "monthly", notes: "" });
  const [simDelta, setSimDelta] = useState(0);
  const [editForm, setEditForm] = useState(null);

  const toMonthlyCalc = (c) => c.frequency === "yearly" ? c.amount / 12 : c.frequency === "weekly" ? c.amount * 4.33 : c.amount;

  const totalMonthly = useMemo(() => charges.reduce((s, c) => s + toMonthlyCalc(c), 0), [charges]);

  const totalDaily = totalMonthly / 30;
  const simTotalMonthly = totalMonthly + simDelta;
  const simTotalDaily = simTotalMonthly / 30;

  // Sales analytics for break-even
  const salesStats = useMemo(() => {
    if (sales.length === 0) return null;
    const byDay = {};
    sales.forEach(s => { const k = s.date.toISOString().split("T")[0]; if (!byDay[k]) byDay[k] = { gross: 0, cost: 0, fees: 0 }; byDay[k].gross += s.totalAmount; byDay[k].fees += s.fee; s.items?.forEach(item => { const sc = item.snapshotCost != null ? item.snapshotCost * item.qty : 0; byDay[k].cost += sc; }); });
    const days = Object.values(byDay);
    const dayCount = days.length;
    const totalGross = days.reduce((s, d) => s + d.gross, 0);
    const totalCost = days.reduce((s, d) => s + d.cost, 0);
    const totalFees = days.reduce((s, d) => s + d.fees, 0);
    const avgDailyGross = dayCount > 0 ? totalGross / dayCount : 0;
    const avgDailyCOGS = dayCount > 0 ? totalCost / dayCount : 0;
    const avgDailyFees = dayCount > 0 ? totalFees / dayCount : 0;
    const avgDailyMarginPct = avgDailyGross > 0 ? (avgDailyGross - avgDailyCOGS) / avgDailyGross : 0.7;
    // Break-even: fixed costs / margin rate
    const breakEvenDaily = avgDailyMarginPct > 0 ? simTotalDaily / avgDailyMarginPct : 0;
    const breakEvenMonthly = breakEvenDaily * 30;
    // Monthly projection based on avg
    const projMonthlyGross = avgDailyGross * 30;
    const projMonthlyCOGS = avgDailyCOGS * 30;
    const projMonthlyFees = avgDailyFees * 30;
    const projMonthlyProfit = projMonthlyGross - projMonthlyCOGS - projMonthlyFees - simTotalMonthly;

    return { dayCount, avgDailyGross, avgDailyCOGS, avgDailyFees, avgDailyMarginPct, breakEvenDaily, breakEvenMonthly, projMonthlyGross, projMonthlyCOGS, projMonthlyFees, projMonthlyProfit, dailyData: Object.entries(byDay).map(([date, d]) => ({ date, ...d, profit: d.gross - d.cost - d.fees })).sort((a, b) => a.date.localeCompare(b.date)) };
  }, [sales, simTotalDaily, simTotalMonthly]);

  // Group charges by category
  const grouped = useMemo(() => {
    const g = {};
    charges.forEach(c => { if (!g[c.category]) g[c.category] = []; g[c.category].push(c); });
    return g;
  }, [charges]);

  const addCharge = () => {
    if (!newCharge.name || !newCharge.amount) return;
    setCharges(prev => [...prev, { ...newCharge, id: uid(), amount: parseFloat(newCharge.amount) }]);
    setNewCharge({ name: "", category: "Loyer & Immo", amount: "", frequency: "monthly", notes: "" });
    setShowForm(false);
  };

  const deleteCharge = (id) => setCharges(prev => prev.filter(c => c.id !== id));

  const updateCharge = (updated) => {
    setCharges(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditModal({ open: false, charge: null });
  };

  const freqLabel = { monthly: "/mois", yearly: "/an", weekly: "/sem" };
  const toMonthly = toMonthlyCalc;

  const isAboveBreakEven = salesStats && salesStats.avgDailyGross > salesStats.breakEvenDaily;

  return (<>
    {/* KPIs */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
      <Card><Metric label="Charges mensuelles" value={totalMonthly.toFixed(0)} sub={`${charges.length} postes`} /></Card>
      <Card><Metric label="Charges / jour" value={totalDaily.toFixed(0)} sub="à couvrir chaque jour" /></Card>
      {salesStats ? (<>
        <Card><Metric label="Seuil rentabilité/jour" value={salesStats.breakEvenDaily.toFixed(0)} sub={`Marge moy. ${(salesStats.avgDailyMarginPct * 100).toFixed(0)}%`} alert={!isAboveBreakEven} /></Card>
        <Card><Metric label="CA moy./jour" value={salesStats.avgDailyGross.toFixed(0)} sub={isAboveBreakEven ? "✓ Au-dessus du seuil" : "⚠ Sous le seuil"} alert={!isAboveBreakEven} /></Card>
        <Card><Metric label="Profit net mensuel" value={salesStats.projMonthlyProfit.toFixed(0)} sub="Projection 30 jours" alert={salesStats.projMonthlyProfit < 0} /></Card>
      </>) : (<>
        <Card><Metric label="Seuil rentabilité" value="—" unit="" sub="Importer des ventes" /></Card>
        <Card><Metric label="Profit net" value="—" unit="" sub="Pas de données ventes" /></Card>
      </>)}
    </div>

    {/* Monthly P&L Projection */}
    {salesStats && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>P&L mensuel projeté <span style={{ fontWeight: 400, color: C.textMuted, fontSize: 11 }}>basé sur {salesStats.dayCount} jours de données</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
          {[
            { label: "CA Brut (×30j)", value: salesStats.projMonthlyGross, color: C.green, bold: true },
            { label: "− Coût matières premières", value: -salesStats.projMonthlyCOGS, color: C.red },
            { label: "− Frais Revolut", value: -salesStats.projMonthlyFees, color: C.red },
            { label: "= Marge brute", value: salesStats.projMonthlyGross - salesStats.projMonthlyCOGS - salesStats.projMonthlyFees, color: C.blue, bold: true, border: true },
            { label: "− Charges fixes" + (simDelta !== 0 ? ` (sim. ${simDelta > 0 ? "+" : ""}${simDelta}€)` : ""), value: -simTotalMonthly, color: C.red },
            { label: "= Résultat net", value: salesStats.projMonthlyProfit, color: salesStats.projMonthlyProfit >= 0 ? C.green : C.red, bold: true, border: true, big: true },
          ].map((row, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: row.big ? "12px 10px" : "8px 10px",
              borderTop: row.border ? `2px solid ${C.border}` : i > 0 ? `1px solid ${C.border}22` : "none",
              background: row.big ? (salesStats.projMonthlyProfit >= 0 ? C.greenPale : C.redPale) : "transparent",
              borderRadius: row.big ? 6 : 0,
            }}>
              <span style={{ fontFamily: fontSans, fontSize: row.bold ? 13 : 12, fontWeight: row.bold ? 600 : 400, color: row.bold ? C.text : C.textMuted }}>{row.label}</span>
              <span style={{ fontFamily: fontMono, fontSize: row.big ? 20 : 14, fontWeight: row.bold ? 700 : 500, color: row.color }}>{row.value >= 0 ? "" : ""}{row.value.toFixed(0)}€</span>
            </div>
          ))}
        </div>
      </Card>
    )}

    {/* Break-even bar */}
    {salesStats && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Seuil de rentabilité journalier</div>
        <div style={{ position: "relative", height: 40, background: C.border + "40", borderRadius: 8, overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${Math.min((salesStats.avgDailyGross / (salesStats.breakEvenDaily * 1.5)) * 100, 100)}%`,
            background: isAboveBreakEven ? `linear-gradient(90deg, ${C.green}90, ${C.green})` : `linear-gradient(90deg, ${C.red}90, ${C.red})`,
            borderRadius: 8, transition: "width 0.6s ease",
          }} />
          <div style={{
            position: "absolute", left: `${Math.min((salesStats.breakEvenDaily / (salesStats.breakEvenDaily * 1.5)) * 100, 95)}%`,
            top: 0, height: "100%", width: 3, background: C.text, opacity: 0.6, borderRadius: 2,
          }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
            {salesStats.avgDailyGross.toFixed(0)}€ / {salesStats.breakEvenDaily.toFixed(0)}€
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted }}>0€</span>
          <span style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted }}>Seuil : {salesStats.breakEvenDaily.toFixed(0)}€</span>
          <span style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted }}>{(salesStats.breakEvenDaily * 1.5).toFixed(0)}€</span>
        </div>
      </Card>
    )}

    {/* Daily P&L with fixed cost line */}
    {salesStats && salesStats.dailyData.length > 1 && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>CA vs seuil de rentabilité par jour</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={salesStats.dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tickFormatter={d => { const dt = new Date(d); return `${DAYS_FR[dt.getDay()]} ${dt.getDate()}`; }} style={{ fontFamily: fontSans, fontSize: 10 }} />
            <YAxis style={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `${v}€`} />
            <Tooltip formatter={v => [`${v.toFixed(0)}€`]} labelFormatter={d => { const dt = new Date(d); return `${DAYS_FR_FULL[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}`; }} contentStyle={{ fontFamily: fontSans, fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="gross" name="CA" radius={[4, 4, 0, 0]}>
              {salesStats.dailyData.map((d, i) => <Cell key={i} fill={d.gross >= salesStats.breakEvenDaily ? C.green : C.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ textAlign: "center", fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Barres vertes = au-dessus du seuil ({salesStats.breakEvenDaily.toFixed(0)}€) · Barres rouges = en dessous
        </div>
      </Card>
    )}

    {/* Charges list */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>Détail des charges</div>
      <Btn onClick={() => setShowForm(!showForm)} style={{ fontSize: 12 }}>{showForm ? "Annuler" : "+ Ajouter une charge"}</Btn>
    </div>

    {showForm && (
      <Card style={{ marginBottom: 16, border: `1px dashed ${C.green}50` }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 1fr 1.5fr", gap: 8, alignItems: "end" }}>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 3 }}>Nom</span>
            <input value={newCharge.name} onChange={e => setNewCharge({ ...newCharge, name: e.target.value })} placeholder="Ex: Loyer" style={{ width: "100%", padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontFamily: fontSans, fontSize: 13, background: C.cream, boxSizing: "border-box" }} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 3 }}>Catégorie</span>
            <select value={newCharge.category} onChange={e => setNewCharge({ ...newCharge, category: e.target.value })} style={{ width: "100%", padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontFamily: fontSans, fontSize: 12, background: C.cream }}>{CHARGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 3 }}>Montant (€)</span>
            <input type="number" step="1" value={newCharge.amount} onChange={e => setNewCharge({ ...newCharge, amount: e.target.value })} placeholder="0" style={{ width: "100%", padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontFamily: fontMono, fontSize: 13, background: C.cream, boxSizing: "border-box" }} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, display: "block", marginBottom: 3 }}>Fréquence</span>
            <select value={newCharge.frequency} onChange={e => setNewCharge({ ...newCharge, frequency: e.target.value })} style={{ width: "100%", padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontFamily: fontSans, fontSize: 12, background: C.cream }}>
              <option value="monthly">Mensuel</option><option value="yearly">Annuel</option><option value="weekly">Hebdo</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
            <input value={newCharge.notes} onChange={e => setNewCharge({ ...newCharge, notes: e.target.value })} placeholder="Notes…" style={{ flex: 1, padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontFamily: fontSans, fontSize: 12, background: C.cream }} />
            <Btn onClick={addCharge} disabled={!newCharge.name || !newCharge.amount} style={{ padding: "7px 14px" }}>OK</Btn>
          </div>
        </div>
      </Card>
    )}

    {Object.entries(grouped).map(([cat, items]) => {
      const catTotal = items.reduce((s, c) => s + toMonthly(c), 0);
      const catPct = totalMonthly > 0 ? (catTotal / totalMonthly * 100) : 0;
      return (
        <Card key={cat} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{cat}</div>
            <div style={{ fontFamily: fontMono, fontSize: 13, color: C.green, fontWeight: 600 }}>{catTotal.toFixed(0)}€<span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}>/mois · {catPct.toFixed(0)}%</span></div>
          </div>
          {/* Category bar */}
          <div style={{ width: "100%", height: 4, background: C.border, borderRadius: 2, marginBottom: 10 }}>
            <div style={{ width: `${catPct}%`, height: "100%", background: C.green, borderRadius: 2, transition: "width 0.4s" }} />
          </div>
          {items.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}>
              <div>
                <div style={{ fontFamily: fontSans, fontSize: 13 }}>{c.name}</div>
                {c.notes && <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted }}>{c.notes}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 500 }}>{c.amount.toFixed(0)}€<span style={{ color: C.textMuted, fontSize: 11 }}>{freqLabel[c.frequency]}</span></div>
                  {c.frequency !== "monthly" && <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted }}>{toMonthly(c).toFixed(0)}€/mois</div>}
                </div>
                <button onClick={() => { setEditForm({ ...c }); setEditModal({ open: true }); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", color: C.textMuted, fontSize: 11, padding: "2px 8px", fontFamily: fontSans }}>✎</button>
                <button onClick={() => deleteCharge(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 13, padding: 4 }}>×</button>
              </div>
            </div>
          ))}
        </Card>
      );
    })}

    {charges.length === 0 && (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontFamily: fontSans, fontSize: 14, color: C.textMuted, marginBottom: 12 }}>Aucune charge enregistrée.</div>
        <Btn onClick={() => setCharges(DEFAULT_CHARGES)}>Charger les charges par défaut</Btn>
      </Card>
    )}

    {/* Simulator */}
    {salesStats && (
      <Card style={{ marginTop: 16, border: simDelta !== 0 ? `1px solid ${C.blue}40` : `1px solid ${C.border}` }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>🔮 Simulateur de scénario</div>
        <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 12 }}>Simule l'impact d'un changement de charges sur ta rentabilité sans modifier les données réelles.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: fontSans, fontSize: 13 }}>Charges mensuelles ajustées :</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSimDelta(d => d - 100)} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, background: C.cream, fontFamily: fontMono, fontSize: 16, cursor: "pointer", color: C.red }}>−</button>
            <input type="number" value={simDelta} onChange={e => setSimDelta(parseInt(e.target.value) || 0)} style={{ width: 80, padding: "6px 8px", border: `1px solid ${simDelta !== 0 ? C.blue : C.border}`, borderRadius: 6, fontFamily: fontMono, fontSize: 14, textAlign: "center", background: simDelta !== 0 ? C.bluePale : C.cream }} />
            <button onClick={() => setSimDelta(d => d + 100)} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`, background: C.cream, fontFamily: fontMono, fontSize: 16, cursor: "pointer", color: C.green }}>+</button>
            <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>€/mois</span>
            {simDelta !== 0 && <button onClick={() => setSimDelta(0)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 10px", fontFamily: fontSans, fontSize: 11, cursor: "pointer", color: C.textMuted }}>Reset</button>}
          </div>
        </div>
        {simDelta !== 0 && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: 12, background: C.bluePale, borderRadius: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>Nouveau seuil/jour</div>
              <div style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: C.blue }}>{salesStats.breakEvenDaily.toFixed(0)}€</div>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted }}>
                {simDelta > 0 ? "↑" : "↓"} {Math.abs(simDelta / 30 / (salesStats.avgDailyMarginPct || 0.7)).toFixed(0)}€ vs actuel
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>Charges simulées</div>
              <div style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: C.blue }}>{simTotalMonthly.toFixed(0)}€</div>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: simDelta > 0 ? C.red : C.green }}>{simDelta > 0 ? "+" : ""}{simDelta}€ vs actuel</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: C.textMuted, textTransform: "uppercase", marginBottom: 2 }}>Profit net projeté</div>
              <div style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: salesStats.projMonthlyProfit >= 0 ? C.green : C.red }}>{salesStats.projMonthlyProfit.toFixed(0)}€</div>
              <div style={{ fontFamily: fontSans, fontSize: 10, color: simDelta > 0 ? C.red : C.green }}>{simDelta > 0 ? "" : "+"}{(-simDelta).toFixed(0)}€ vs actuel</div>
            </div>
          </div>
        )}
      </Card>
    )}

    {/* Edit Modal */}
    <Modal open={editModal.open} onClose={() => setEditModal({ open: false })} title="Modifier la charge">
      {editForm && (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Nom</span>
            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Catégorie</span>
            <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream }}>{CHARGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Montant (€)</span>
            <input type="number" step="1" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontMono, fontSize: 14, background: C.cream, boxSizing: "border-box" }} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Fréquence</span>
            <select value={editForm.frequency} onChange={e => setEditForm({ ...editForm, frequency: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream }}>
              <option value="monthly">Mensuel</option><option value="yearly">Annuel</option><option value="weekly">Hebdo</option>
            </select>
          </label>
          <label style={{ display: "block", gridColumn: "1 / -1" }}>
            <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Notes</span>
            <input value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes optionnelles…" style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" }} />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="secondary" onClick={() => setEditModal({ open: false })}>Annuler</Btn>
          <Btn onClick={() => { updateCharge(editForm); }}>Enregistrer</Btn>
        </div>
      </>)}
    </Modal>
  </>);
}

// ════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════
const SK_COSTING = "estudantina-costing-v2";
const SK_SALES = "estudantina-sales-v2";
const SK_CHARGES = "estudantina-charges-v1";

export default function App() {
  const [page, setPage] = useState("costing");
  const [ingredients, setIngredients] = useState(DEFAULT_INGREDIENTS);
  const [recipes, setRecipes] = useState(DEFAULT_RECIPES);
  const [sales, setSales] = useState([]);
  const [charges, setCharges] = useState(DEFAULT_CHARGES);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const stRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await store.get(SK_COSTING);
        if (raw) { const d = JSON.parse(raw); if (d.ingredients?.length) setIngredients(d.ingredients); if (d.recipes?.length) setRecipes(d.recipes); }
        const sr = await store.get(SK_SALES);
        if (sr) { const d = JSON.parse(sr); if (d.sales?.length) setSales(d.sales.map(s => ({ ...s, date: new Date(s.date) }))); }
        const cr = await store.get(SK_CHARGES);
        if (cr) { const d = JSON.parse(cr); if (d.charges?.length) setCharges(d.charges); }
      } catch (e) { console.warn(e); }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await store.set(SK_COSTING, JSON.stringify({ ingredients, recipes }));
      await store.set(SK_SALES, JSON.stringify({ sales: sales.map(s => ({ ...s, date: s.date?.toISOString() })) }));
      await store.set(SK_CHARGES, JSON.stringify({ charges }));
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    clearTimeout(stRef.current);
    stRef.current = setTimeout(() => setSaveStatus(null), 2000);
  }, [ingredients, recipes, sales, charges]);

  useEffect(() => { if (!loaded) return; const t = setTimeout(() => persist(), 500); return () => clearTimeout(t); }, [ingredients, recipes, sales, charges, loaded, persist]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: fontSans, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ background: C.green, color: "#fff", padding: "20px 24px 0", borderBottom: "3px solid #1E3D28" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontFamily: font, fontSize: 28, fontWeight: 400, margin: 0, fontStyle: "italic" }}>Estudantina</h1>
              <SaveIndicator status={saveStatus} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            {[{ id: "costing", label: "📊 Costing" }, { id: "sales", label: "💰 Sales" }, { id: "charges", label: "📋 Tréso" }].map(tab => (
              <button key={tab.id} onClick={() => setPage(tab.id)} style={{ padding: "10px 20px", fontFamily: fontSans, fontSize: 13, fontWeight: 600, background: page === tab.id ? C.bg : "transparent", color: page === tab.id ? C.green : "rgba(255,255,255,0.7)", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer" }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px 40px" }}>
        {page === "costing" && <CostingPage ingredients={ingredients} setIngredients={setIngredients} recipes={recipes} setRecipes={setRecipes} />}
        {page === "sales" && <SalesPage sales={sales} setSales={setSales} recipes={recipes} ingredients={ingredients} />}
        {page === "charges" && <ChargesPage charges={charges} setCharges={setCharges} sales={sales} ingredients={ingredients} recipes={recipes} />}
      </div>
    </div>
  );
}