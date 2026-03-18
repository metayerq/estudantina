import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import store from "./services/storage.js";
import { computeShiftMetrics, getShiftAlertLevel, calcUnitCost, calcRecipeCost, getMargin, THRESHOLDS } from "./utils/shiftMetrics.js";
import { createShift as addShift, updateShift as editShift, deleteShift as removeShift } from "./services/shiftService.js";
import { computeMenuPerformance, getQuadrantStyle, getActionRecommendations, computeBreakEven } from "./utils/menuPerformanceService.js";
import { stampShiftSnapshots } from "./services/snapshotService.js";
import { addPriceEntry, getCurrentPrice } from "./services/priceHistoryService.js";
import { loadData, migrateToV6, ensureSuppliers, ensurePriceHistory, CURRENT_SK, DEFAULT_SETTINGS } from "./services/migrationService.js";
import { generateAlerts, mergeAlerts, dismissAlert as dismissAlertFn, getActiveAlertCount } from "./services/alertService.js";
import { getSupplierIngredients, getSupplierLastUpdate } from "./services/supplierService.js";
import { computeCostDrift, computeDriftSummary, getIngredientTimeline, computeMarginErosion } from "./services/costDriftService.js";
import { filterShiftsByDays } from "./services/analyticsService.js";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LineChart, Line } from "recharts";
import { C, font, fontMono, fontSans, CATEGORIES, UNITS, PERIODS, uid, catColors, Badge, Metric, MarginBar, Modal, Btn, SaveIndicator } from "./components/shared.jsx";
import Dashboard from "./components/Dashboard.jsx";
import FixedChargesPanel from "./components/FixedChargesPanel.jsx";
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
// ─── Recipe Components ──────────────────────────────────────────
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
function IngredientModal({ open, onClose, ingredients, onSave, onOpenPriceUpdate }) {
  const [list, setList] = useState(ingredients);
  const [n, setN] = useState({ name: "", unit: "kg", pricePerUnit: "", supplier: "", wasteFactor: "1.0" });
  useEffect(() => { setList(ingredients); }, [ingredients]);
  return (
    <Modal open={open} onClose={onClose} title="Ingredient base" wide>
      <div style={{ padding: "8px 12px", background: C.amberPale, borderRadius: 6, marginBottom: 14, fontFamily: fontSans, fontSize: 12, color: C.amber }}><strong>Waste factor</strong>: 1.00 = no waste. 1.10 = 10% waste.</div>
      <div style={{ maxHeight: 350, overflow: "auto", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Ingredient</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Price/u</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Waste</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Real cost</th><th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Supplier</th><th style={{ width: 28 }}></th></tr></thead>
          <tbody>{list.map(ing => { const rc = ing.pricePerUnit * (ing.wasteFactor || 1); const hw = (ing.wasteFactor || 1) > 1; return (<tr key={ing.id} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "5px 6px" }}>{ing.name} <span style={{ color: C.textMuted, fontSize: 11 }}>/{ing.unit}</span></td><td style={{ padding: "5px 6px" }}><input type="number" step="0.01" value={ing.pricePerUnit} onChange={e => setList(list.map(i => i.id === ing.id ? { ...i, pricePerUnit: parseFloat(e.target.value) || 0 } : i))} style={{ width: 64, padding: "3px 5px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: C.cream }} />€</td><td style={{ padding: "5px 6px" }}><input type="number" step="0.01" min="1" value={ing.wasteFactor ?? 1} onChange={e => setList(list.map(i => i.id === ing.id ? { ...i, wasteFactor: parseFloat(e.target.value) || 1 } : i))} style={{ width: 52, padding: "3px 5px", border: `1px solid ${hw ? C.amber : C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 12, background: hw ? C.amberPale : C.cream }} /></td><td style={{ padding: "5px 6px", fontFamily: fontMono, fontSize: 12, color: hw ? C.amber : C.textMuted }}>{rc.toFixed(3)}€</td><td style={{ padding: "5px 6px", color: C.textMuted, fontSize: 12 }}>{ing.supplier}</td><td style={{ display: "flex", gap: 2 }}>{onOpenPriceUpdate && <button onClick={() => onOpenPriceUpdate(ing)} title="Update price" style={{ background: "none", border: "none", cursor: "pointer", color: C.green, fontSize: 12 }}>✎</button>}<button onClick={() => setList(list.filter(i => i.id !== ing.id))} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 14 }}>×</button></td></tr>); })}</tbody>
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
// ─── Shift Components ───────────────────────────────────────────
function ShiftCard({ shift, recipes, ingredients, onEdit, onDelete }) {
  const metrics = useMemo(() => computeShiftMetrics(shift, recipes, ingredients), [shift, recipes, ingredients]);
  const alertLevel = getShiftAlertLevel(metrics);
  const periodLabel = { morning: "Morning", afternoon: "Afternoon", full_day: "Full Day" }[shift.period] || shift.period;
  const borderColor = alertLevel === "red" ? `${C.red}30` : alertLevel === "amber" ? `${C.amber}30` : C.border;
  const alertBg = alertLevel === "red" ? C.redPale : alertLevel === "amber" ? C.amberPale : C.greenPale;
  const alertColor = alertLevel === "red" ? C.red : alertLevel === "amber" ? C.amber : C.green;
  const totalItems = shift.sales.reduce((sum, s) => sum + s.quantity, 0);
  const topItem = useMemo(() => {
    if (shift.sales.length === 0) return null;
    const top = [...shift.sales].sort((a, b) => b.quantity - a.quantity)[0];
    const recipe = recipes.find(r => r.id === top.recipe_id);
    return recipe ? { name: recipe.name, qty: top.quantity } : null;
  }, [shift.sales, recipes]);

  return (
    <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${borderColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge color={alertColor} bg={alertBg}>{periodLabel}</Badge>
            <span style={{ fontSize: 14 }}>{alertLevel === "green" ? "🟢" : "🔴"}</span>
          </div>
          <h4 style={{ fontFamily: font, fontSize: 19, margin: "6px 0 0" }}>
            {new Date(shift.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          </h4>
          <div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>
            {shift.staff_count} {shift.staff_count > 1 ? "baristas" : "barista"} · {shift.hours_worked}h
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(shift)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>✎</button>
          <button onClick={() => onDelete(shift.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: fontSans, fontSize: 12, color: C.red }}>✕</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14, padding: "12px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Metric label="Revenue" value={metrics.revenue.toFixed(0)} size="small" />
        <Metric label="Gross P." value={`${metrics.gross_margin_pct.toFixed(1)}`} unit="%" size="small" alert={metrics.gross_margin_pct < THRESHOLDS.MIN_GROSS_MARGIN} />
        <Metric label="Labor" value={metrics.labor_cost.toFixed(0)} size="small" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>Net profit</span>
        <span style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 700, color: metrics.is_profitable ? C.green : C.red }}>€{metrics.net_profit.toFixed(0)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>Rev/labor hr</span>
        <span style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 600, color: metrics.revenue_per_labor_hour < THRESHOLDS.MIN_REV_PER_LABOR_HOUR ? C.amber : C.green }}>€{metrics.revenue_per_labor_hour.toFixed(1)}</span>
      </div>
      {topItem && (
        <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginTop: 6 }}>
          Top item: {topItem.name} ×{topItem.qty}
        </div>
      )}
      {metrics.hasEstimatedCosts && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <Badge color={C.amber} bg={C.amberPale}>⚠ Estimated costs</Badge>
        </div>
      )}
      {alertLevel !== "green" && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: alertBg, borderRadius: 6, fontFamily: fontSans, fontSize: 11, color: alertColor }}>
          {!metrics.is_profitable
            ? "⚠ Unprofitable — labor cost exceeds gross profit"
            : metrics.gross_margin_pct < THRESHOLDS.MIN_GROSS_MARGIN
              ? `⚠ Gross margin (${metrics.gross_margin_pct.toFixed(1)}%) below ${THRESHOLDS.MIN_GROSS_MARGIN}%`
              : `⚠ Rev/hour (€${metrics.revenue_per_labor_hour.toFixed(1)}) below €${THRESHOLDS.MIN_REV_PER_LABOR_HOUR}`
          }
        </div>
      )}
    </div>
  );
}
function ShiftDashboard({ shifts, recipes, ingredients, onEdit, onDelete, onNew }) {
  const sorted = useMemo(() => [...shifts].sort((a, b) => new Date(b.date) - new Date(a.date)), [shifts]);
  const summary = useMemo(() => {
    let totalMargin = 0, totalRevPerHr = 0, unprofitable = 0, count = 0;
    for (const s of shifts) {
      const m = computeShiftMetrics(s, recipes, ingredients);
      if (m.revenue > 0) { totalMargin += m.gross_margin_pct; totalRevPerHr += m.revenue_per_labor_hour; count++; }
      if (!m.is_profitable) unprofitable++;
    }
    return { total: shifts.length, avgMargin: count > 0 ? totalMargin / count : 0, avgRevPerHr: count > 0 ? totalRevPerHr / count : 0, unprofitable };
  }, [shifts, recipes, ingredients]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, padding: 20, background: C.card, borderRadius: 10, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <Metric label="Shifts logged" value={summary.total} unit="" />
        <Metric label="Avg net margin" value={summary.avgMargin.toFixed(1)} unit="%" />
        <Metric label="Avg rev/labor hr" value={`€${summary.avgRevPerHr.toFixed(0)}`} unit="" />
        <Metric label="Unprofitable" value={summary.unprofitable} unit="" alert={summary.unprofitable > 0} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {sorted.map(s => <ShiftCard key={s.id} shift={s} recipes={recipes} ingredients={ingredients} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
      {shifts.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
          <div style={{ fontFamily: font, fontSize: 20, marginBottom: 8 }}>No shifts logged yet</div>
          <Btn onClick={onNew}>+ Log a shift</Btn>
        </div>
      )}
    </>
  );
}
function ShiftForm({ shift, recipes, ingredients, onSave, onCancel, shiftTemplates = [], onSaveTemplate, onDeleteTemplate, onLogAsReal }) {
  const blank = { date: new Date().toISOString().slice(0, 10), period: "morning", staff_count: 1, hours_worked: 6, hourly_rate: 5.50, sales: [], notes: "" };
  const [f, setF] = useState(shift || blank);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [mode, setMode] = useState("real");
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  useEffect(() => { setF(shift || blank); }, [shift]);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const salesMap = useMemo(() => {
    const m = {};
    for (const s of f.sales) m[s.recipe_id] = s.quantity;
    return m;
  }, [f.sales]);

  const setQty = (recipeId, qty) => {
    setF(prev => {
      const existing = prev.sales.find(s => s.recipe_id === recipeId);
      let newSales;
      if (existing) {
        newSales = qty <= 0 ? prev.sales.filter(s => s.recipe_id !== recipeId) : prev.sales.map(s => s.recipe_id === recipeId ? { ...s, quantity: qty } : s);
      } else if (qty > 0) {
        newSales = [...prev.sales, { recipe_id: recipeId, quantity: qty }];
      } else {
        newSales = prev.sales;
      }
      return { ...prev, sales: newSales };
    });
  };

  const metrics = useMemo(() => computeShiftMetrics(f, recipes, ingredients), [f, recipes, ingredients]);
  const alertLevel = getShiftAlertLevel(metrics);
  const recipesByCategory = useMemo(() => {
    const grouped = {};
    for (const cat of CATEGORIES) grouped[cat] = recipes.filter(r => r.category === cat);
    return grouped;
  }, [recipes]);

  const breakEven = useMemo(() => mode === "simulate" ? computeBreakEven(f, recipes, ingredients) : null, [mode, f, recipes, ingredients]);

  const loadTemplate = (id) => {
    setSelectedTemplateId(id);
    const t = shiftTemplates.find(x => x.id === id);
    if (t) setF(prev => ({ ...prev, sales: t.sales, staff_count: t.staff_count, hours_worked: t.hours_worked, hourly_rate: t.hourly_rate, period: t.period }));
  };

  const inputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" };
  const labelStyle = { fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 };

  const previewPanel = (
    <div style={{ position: isMobile ? "static" : "sticky", top: 20 }}>
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${alertLevel === "red" ? `${C.red}30` : alertLevel === "amber" ? `${C.amber}30` : mode === "simulate" ? `${C.amber}60` : C.border}` }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{mode === "simulate" ? "Simulation preview" : "Live preview"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Metric label="Revenue" value={metrics.revenue.toFixed(2)} size="small" />
          <Metric label="COGS" value={metrics.totalCOGS.toFixed(2)} size="small" />
          <Metric label="Gross profit" value={metrics.gross_profit.toFixed(2)} size="small" />
          <Metric label="Labor cost" value={metrics.labor_cost.toFixed(2)} size="small" />
        </div>
        <div style={{ padding: "12px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <Metric label="Net profit" value={metrics.net_profit.toFixed(2)} alert={!metrics.is_profitable} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Metric label="Gross margin" value={metrics.gross_margin_pct.toFixed(1)} unit="%" size="small" alert={metrics.gross_margin_pct < THRESHOLDS.MIN_GROSS_MARGIN} />
          <Metric label="Rev/labor hr" value={metrics.revenue_per_labor_hour.toFixed(1)} size="small" alert={metrics.revenue_per_labor_hour < THRESHOLDS.MIN_REV_PER_LABOR_HOUR} />
        </div>
        {alertLevel !== "green" && metrics.revenue > 0 && (
          <div style={{ padding: "8px 10px", background: alertLevel === "red" ? C.redPale : C.amberPale, borderRadius: 6, fontFamily: fontSans, fontSize: 11, color: alertLevel === "red" ? C.red : C.amber, marginBottom: 12 }}>
            {!metrics.is_profitable ? "This shift is unprofitable" : "Margin or efficiency below threshold"}
          </div>
        )}
        {mode === "simulate" && breakEven && metrics.revenue > 0 && (
          <div style={{ padding: 12, background: breakEven.isAlreadyProfitable ? C.greenPale : C.amberPale, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.textMuted, marginBottom: 6 }}>Break-even</div>
            {breakEven.isAlreadyProfitable ? (
              <div style={{ fontFamily: fontSans, fontSize: 13, color: C.green }}>Already profitable at €{breakEven.currentNetProfit.toFixed(2)} net</div>
            ) : (
              <div style={{ fontFamily: fontSans, fontSize: 13, color: C.amber }}>
                Sell <strong>{breakEven.additionalUnits}</strong> more <strong>{breakEven.recipe?.name}</strong> to break even
              </div>
            )}
          </div>
        )}
        {mode === "simulate" && (
          <div style={{ padding: 14, background: C.cream, borderRadius: 8, border: `1px dashed ${C.border}` }}>
            <div style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>Scenarios</div>
            <select value={selectedTemplateId || ""} onChange={e => e.target.value ? loadTemplate(e.target.value) : setSelectedTemplateId(null)} style={{ ...inputStyle, marginBottom: 8 }}>
              <option value="">— Load a scenario —</option>
              {shiftTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="Scenario name" value={templateName} onChange={e => setTemplateName(e.target.value)} style={{ flex: 1, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12, background: C.card }} />
              <Btn onClick={() => { if (!templateName) return; onSaveTemplate({ id: uid(), name: templateName, sales: f.sales, staff_count: f.staff_count, hours_worked: f.hours_worked, hourly_rate: f.hourly_rate, period: f.period }); setTemplateName(""); }} disabled={!templateName} style={{ fontSize: 11, padding: "6px 12px" }}>Save</Btn>
            </div>
            {selectedTemplateId && <button onClick={() => { onDeleteTemplate(selectedTemplateId); setSelectedTemplateId(null); }} style={{ background: "none", border: "none", fontFamily: fontSans, fontSize: 11, color: C.red, cursor: "pointer", marginTop: 6, padding: 0 }}>Delete this scenario</button>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        {mode === "simulate" ? (
          <Btn onClick={() => onLogAsReal(f)} disabled={f.sales.length === 0}>Log as real shift</Btn>
        ) : (
          <Btn onClick={() => onSave(f)} disabled={!f.date || f.sales.length === 0}>Save shift</Btn>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: fontSans, fontSize: 13, color: C.green, marginBottom: 16, padding: 0 }}>← Back to shifts</button>
      {!shift && (
        <div style={{ display: "flex", gap: 2, background: C.border, borderRadius: 8, padding: 2, marginBottom: 16, width: "fit-content" }}>
          <button onClick={() => setMode("real")} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: mode === "real" ? C.card : "transparent", color: mode === "real" ? C.green : C.textMuted, fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Real</button>
          <button onClick={() => setMode("simulate")} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: mode === "simulate" ? C.card : "transparent", color: mode === "simulate" ? C.amber : C.textMuted, fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Simulate</button>
        </div>
      )}
      <h2 style={{ fontFamily: font, fontSize: 24, margin: "0 0 20px", color: mode === "simulate" ? C.amber : C.green }}>{shift ? "Edit shift" : mode === "simulate" ? "Shift Simulator" : "Log a shift"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Shift details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block" }}><span style={labelStyle}>Date</span><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} style={inputStyle} /></label>
              <label style={{ display: "block" }}><span style={labelStyle}>Period</span><select value={f.period} onChange={e => setF({ ...f, period: e.target.value })} style={inputStyle}>{PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
              <label style={{ display: "block" }}><span style={labelStyle}>Staff count</span><input type="number" min="1" value={f.staff_count} onChange={e => setF({ ...f, staff_count: parseInt(e.target.value) || 1 })} style={{ ...inputStyle, fontFamily: fontMono }} /></label>
              <label style={{ display: "block" }}><span style={labelStyle}>Hours worked</span><input type="number" min="0" step="0.5" value={f.hours_worked} onChange={e => setF({ ...f, hours_worked: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, fontFamily: fontMono }} /></label>
              <label style={{ display: "block" }}><span style={labelStyle}>Hourly rate (€)</span><input type="number" min="0" step="0.10" value={f.hourly_rate} onChange={e => setF({ ...f, hourly_rate: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, fontFamily: fontMono }} /></label>
              <label style={{ display: "block" }}><span style={labelStyle}>Notes</span><input value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="E.g. Holiday weekend…" style={inputStyle} /></label>
            </div>
          </div>
          <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Sales</div>
            {CATEGORIES.map(cat => {
              const catRecipes = recipesByCategory[cat] || [];
              if (catRecipes.length === 0) return null;
              const cc = catColors[cat] || { bg: C.greenPale, color: C.green };
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <Badge color={cc.color} bg={cc.bg}>{cat}</Badge>
                  <div style={{ marginTop: 8 }}>
                    {catRecipes.map(recipe => {
                      const qty = salesMap[recipe.id] || 0;
                      return (
                        <div key={recipe.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div>
                            <span style={{ fontFamily: fontSans, fontSize: 13 }}>{recipe.name}</span>
                            <span style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{recipe.sellingPrice.toFixed(2)}€</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button onClick={() => setQty(recipe.id, Math.max(0, qty - 1))} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontSize: 16, color: C.textMuted }}>−</button>
                            <input type="number" min="0" value={qty} onChange={e => setQty(recipe.id, parseInt(e.target.value) || 0)} style={{ width: 48, textAlign: "center", padding: "4px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontMono, fontSize: 13, background: qty > 0 ? C.greenPale : C.cream }} />
                            <button onClick={() => setQty(recipe.id, qty + 1)} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontSize: 16, color: C.green }}>+</button>
                            {qty > 0 && <span style={{ fontFamily: fontMono, fontSize: 11, color: C.green, minWidth: 50, textAlign: "right" }}>{(recipe.sellingPrice * qty).toFixed(2)}€</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {isMobile && <div style={{ marginTop: 20 }}>{previewPanel}</div>}
        </div>
        {!isMobile && previewPanel}
      </div>
    </div>
  );
}
// ─── Menu Performance ────────────────────────────────────────────
function CustomMatrixTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const qs = getQuadrantStyle(d.quadrant);
  return (
    <div style={{ background: C.card, padding: 12, borderRadius: 8, boxShadow: C.shadowLg, border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: font, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{d.recipe.name}</div>
      <div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
        {d.totalQty} units sold · €{d.totalRevenue.toFixed(0)} revenue<br />
        Margin: {d.avgMargin.toFixed(1)}%
      </div>
      <Badge color={qs.color} bg={qs.bg}>{qs.label}</Badge>
    </div>
  );
}

function MenuPerformanceView({ recipes, ingredients, shifts, menuSort, setMenuSort, menuFilterCat, setMenuFilterCat, menuFilterQuadrant, setMenuFilterQuadrant, menuDateRange, setMenuDateRange, onNavigateToShifts }) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const filteredShifts = useMemo(() => {
    if (menuDateRange === "all") return shifts;
    const days = { "7d": 7, "30d": 30, "90d": 90 }[menuDateRange] || 30;
    return filterShiftsByDays(shifts, days);
  }, [shifts, menuDateRange]);

  const performanceData = useMemo(() => computeMenuPerformance(recipes, ingredients, filteredShifts), [recipes, ingredients, filteredShifts]);
  const actions = useMemo(() => getActionRecommendations(performanceData), [performanceData]);

  const medianQty = useMemo(() => {
    if (performanceData.length === 0) return 0;
    const sorted = [...performanceData].sort((a, b) => a.totalQty - b.totalQty);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1].totalQty + sorted[mid].totalQty) / 2 : sorted[mid].totalQty;
  }, [performanceData]);

  const toggleSort = (key) => {
    setMenuSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  };

  const sortedFiltered = useMemo(() => {
    let data = [...performanceData];
    if (menuFilterCat !== "All") data = data.filter(d => d.recipe.category === menuFilterCat);
    if (menuFilterQuadrant !== "All") data = data.filter(d => d.quadrant === menuFilterQuadrant);
    data.sort((a, b) => {
      let va, vb;
      if (menuSort.key === "name") { va = a.recipe.name.toLowerCase(); vb = b.recipe.name.toLowerCase(); }
      else if (menuSort.key === "category") { va = a.recipe.category; vb = b.recipe.category; }
      else { va = a[menuSort.key]; vb = b[menuSort.key]; }
      if (va < vb) return menuSort.dir === "asc" ? -1 : 1;
      if (va > vb) return menuSort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [performanceData, menuFilterCat, menuFilterQuadrant, menuSort]);

  if (shifts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
        <div style={{ fontFamily: font, fontSize: 22, marginBottom: 8 }}>No shifts logged yet</div>
        <div style={{ fontFamily: fontSans, fontSize: 14, marginBottom: 16 }}>Log some shifts first to see your menu performance</div>
        <Btn onClick={onNavigateToShifts}>Go to Shifts</Btn>
      </div>
    );
  }

  if (performanceData.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
        <div style={{ fontFamily: font, fontSize: 22, marginBottom: 8 }}>No sales data yet</div>
        <div style={{ fontFamily: fontSans, fontSize: 14 }}>Your logged shifts have no sales — add sales to see the menu matrix</div>
      </div>
    );
  }

  const filterPill = (key, label, active, onClick) => (
    <button key={key} onClick={onClick} style={{ padding: "5px 12px", borderRadius: 20, border: active ? "none" : `1px solid ${C.border}`, background: active ? C.green : "transparent", color: active ? "#fff" : C.textMuted, fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );

  const colHeader = (key, label) => (
    <th onClick={() => toggleSort(key)} style={{ padding: 6, cursor: "pointer", color: C.textMuted, fontSize: 10, textTransform: "uppercase", userSelect: "none", whiteSpace: "nowrap", fontFamily: fontSans }}>
      {label} {menuSort.key === key ? (menuSort.dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <>
      {/* Chart */}
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Performance Matrix</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }, { value: "all", label: "All time" }].map(opt => filterPill(`dr-${opt.value}`, opt.label, menuDateRange === opt.value, () => setMenuDateRange(opt.value)))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 260 : 360}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <XAxis type="number" dataKey="totalQty" name="Units Sold" tick={{ fontFamily: fontMono, fontSize: 11 }} label={{ value: "Units sold", position: "bottom", offset: 0, style: { fontFamily: fontSans, fontSize: 11, fill: C.textMuted } }} />
            <YAxis type="number" dataKey="avgMargin" name="Margin %" domain={[0, 100]} tick={{ fontFamily: fontMono, fontSize: 11 }} label={{ value: "Gross margin %", angle: -90, position: "insideLeft", style: { fontFamily: fontSans, fontSize: 11, fill: C.textMuted } }} />
            <ZAxis type="number" dataKey="totalRevenue" range={isMobile ? [40, 300] : [60, 600]} name="Revenue" />
            <ReferenceLine y={THRESHOLDS.MIN_GROSS_MARGIN} stroke={C.border} strokeDasharray="4 4" label={{ value: `${THRESHOLDS.MIN_GROSS_MARGIN}%`, position: "right", style: { fontFamily: fontMono, fontSize: 10, fill: C.textMuted } }} />
            <ReferenceLine x={medianQty} stroke={C.border} strokeDasharray="4 4" />
            <Tooltip content={<CustomMatrixTooltip />} />
            <Scatter data={performanceData}>
              {performanceData.map((entry, i) => {
                const qs = getQuadrantStyle(entry.quadrant);
                return <Cell key={i} fill={qs.color} fillOpacity={0.7} />;
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
          {["star", "hidden_gem", "question", "dog"].map(q => {
            const qs = getQuadrantStyle(q);
            return <span key={q} style={{ fontFamily: fontSans, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: qs.color, display: "inline-block" }} />{qs.label}</span>;
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Recipe breakdown</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["All", ...CATEGORIES].map(c => filterPill(`cat-${c}`, c, menuFilterCat === c, () => setMenuFilterCat(c)))}
            <span key="sep" style={{ width: 1, background: C.border, margin: "0 4px" }} />
            {["All", "star", "hidden_gem", "question", "dog"].map(q => {
              const qs = q === "All" ? { label: "All" } : getQuadrantStyle(q);
              return filterPill(`q-${q}`, qs.label, menuFilterQuadrant === q, () => setMenuFilterQuadrant(q));
            })}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}>
              {colHeader("name", "Recipe")}
              {colHeader("category", "Category")}
              {colHeader("totalQty", "Units")}
              {colHeader("totalRevenue", "Revenue")}
              {colHeader("avgMargin", "Margin %")}
              {colHeader("quadrant", "Quadrant")}
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map(d => {
              const qs = getQuadrantStyle(d.quadrant);
              const cc = catColors[d.recipe.category] || { bg: C.greenPale, color: C.green };
              return (
                <tr key={d.recipe.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "5px 6px", fontWeight: 500 }}>{d.recipe.name}</td>
                  <td style={{ padding: "5px 6px" }}><Badge color={cc.color} bg={cc.bg}>{d.recipe.category}</Badge></td>
                  <td style={{ padding: "5px 6px", fontFamily: fontMono }}>{d.totalQty}</td>
                  <td style={{ padding: "5px 6px", fontFamily: fontMono }}>€{d.totalRevenue.toFixed(0)}</td>
                  <td style={{ padding: "5px 6px", fontFamily: fontMono, color: d.avgMargin >= THRESHOLDS.MIN_GROSS_MARGIN ? C.green : C.red }}>{d.avgMargin.toFixed(1)}%</td>
                  <td style={{ padding: "5px 6px" }}><Badge color={qs.color} bg={qs.bg}>{qs.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedFiltered.length === 0 && <div style={{ textAlign: "center", padding: 20, color: C.textMuted, fontFamily: fontSans, fontSize: 13 }}>No recipes match the current filters</div>}
      </div>

      {/* Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {actions.map(a => {
          const qs = getQuadrantStyle(a.quadrant);
          return (
            <div key={a.quadrant} style={{ background: C.card, borderRadius: 10, padding: 16, boxShadow: C.shadow, borderLeft: `4px solid ${qs.color}` }}>
              <Badge color={qs.color} bg={qs.bg}>{qs.label}</Badge>
              <div style={{ fontFamily: fontSans, fontSize: 13, marginTop: 8, lineHeight: 1.5, color: C.text }}>{a.message}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Price Update Modal ──────────────────────────────────────────
function PriceUpdateModal({ ingredient, recipes, ingredients, onSave, onClose }) {
  const [newPrice, setNewPrice] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (ingredient) {
      setNewPrice("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setInvoiceRef("");
      setNote("");
    }
  }, [ingredient]);
  if (!ingredient) return null;

  const currentPrice = getCurrentPrice(ingredient);
  const lastEntry = ingredient.price_history && ingredient.price_history.length > 0
    ? [...ingredient.price_history].sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
    : null;

  const parsedPrice = parseFloat(newPrice);
  const validPrice = !isNaN(parsedPrice) && parsedPrice > 0;

  const impactedRecipes = validPrice ? recipes.filter(r => r.items.some(item => item.ingredientId === ingredient.id)).map(r => {
    const currentCost = calcUnitCost(r, ingredients);
    const currentMargin = getMargin(r.sellingPrice, currentCost);
    const simIngredients = ingredients.map(i => i.id === ingredient.id ? { ...i, pricePerUnit: parsedPrice } : i);
    const newCost = calcUnitCost(r, simIngredients);
    const newMargin = getMargin(r.sellingPrice, newCost);
    return { recipe: r, currentMargin, newMargin, delta: newMargin - currentMargin };
  }) : [];

  const handleSave = () => {
    if (!validPrice) return;
    const updated = addPriceEntry(ingredient, { price_per_unit: parsedPrice, effective_date: effectiveDate, note, invoice_ref: invoiceRef });
    onSave(updated);
  };

  const inputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.cream, boxSizing: "border-box" };

  return (
    <Modal open={true} onClose={onClose} title={`Update price — ${ingredient.name}`}>
      <div style={{ fontFamily: fontSans, fontSize: 13, marginBottom: 16, color: C.textMuted }}>
        Current price: <strong style={{ color: C.text }}>€{currentPrice.toFixed(2)} / {ingredient.unit}</strong>
        {lastEntry && <span> (set on {lastEntry.effective_date})</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>New price per {ingredient.unit} (€)</span>
          <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder={currentPrice.toFixed(2)} style={{ ...inputStyle, fontFamily: fontMono }} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Effective date</span>
          <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Invoice ref (optional)</span>
          <input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="INV-041" style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Note (optional)</span>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="" style={inputStyle} />
        </label>
      </div>
      {validPrice && impactedRecipes.length > 0 && (
        <div style={{ padding: 14, background: C.cream, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 16 }}>
          <div style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>Impact preview — {impactedRecipes.length} recipe{impactedRecipes.length > 1 ? "s" : ""} affected</div>
          {impactedRecipes.map(({ recipe, currentMargin, newMargin, delta }) => {
            const belowTarget = newMargin < recipe.targetMargin;
            return (
              <div key={recipe.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: fontSans, fontSize: 13 }}>{recipe.name}</span>
                <span style={{ fontFamily: fontMono, fontSize: 12 }}>
                  <span style={{ color: C.textMuted }}>{currentMargin.toFixed(1)}%</span>
                  <span style={{ color: C.textMuted }}> → </span>
                  <span style={{ color: belowTarget ? C.red : delta < -2 ? C.amber : C.green, fontWeight: 600 }}>{newMargin.toFixed(1)}%</span>
                  {belowTarget && <span style={{ marginLeft: 4, color: C.amber }}>⚠</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!validPrice}>Save price</Btn>
      </div>
    </Modal>
  );
}

// ─── Supplier Components ─────────────────────────────────────────
function SupplierList({ suppliers, ingredients, onSelectSupplier }) {
  if (suppliers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
        <div style={{ fontFamily: font, fontSize: 22, marginBottom: 8 }}>No suppliers yet</div>
        <div style={{ fontFamily: fontSans, fontSize: 14 }}>Suppliers will be created automatically from your ingredient data</div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
      {suppliers.map(supplier => {
        const supplierIngs = getSupplierIngredients(supplier, ingredients);
        const lastUpdate = getSupplierLastUpdate(supplier, ingredients);
        const catStyle = { "Wholesale": { bg: "#E8EEF5", color: "#2E5A8A" }, "Market": { bg: "#F5EDE8", color: "#8A5A2E" }, "Specialty": { bg: "#E8F0EA", color: "#2D5A3D" }, "House": { bg: "#F0ECF5", color: "#5A2E8A" } };
        const cs = catStyle[supplier.category] || { bg: C.greenPale, color: C.green };
        return (
          <div key={supplier.id} onClick={() => onSelectSupplier(supplier.id)} style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, cursor: "pointer", transition: "box-shadow 0.2s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <h4 style={{ fontFamily: font, fontSize: 19, margin: 0 }}>{supplier.name}</h4>
              <Badge color={cs.color} bg={cs.bg}>{supplier.category}</Badge>
            </div>
            <div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
              {supplierIngs.length} ingredient{supplierIngs.length !== 1 ? "s" : ""}
              {lastUpdate && <span> · Last update: {lastUpdate}</span>}
            </div>
            {supplierIngs.slice(0, 3).map(ing => (
              <div key={ing.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontFamily: fontSans, fontSize: 12 }}>
                <span>{ing.name}</span>
                <span style={{ fontFamily: fontMono, color: C.textMuted }}>€{ing.pricePerUnit.toFixed(2)}/{ing.unit}</span>
              </div>
            ))}
            {supplierIngs.length > 3 && <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginTop: 6 }}>+{supplierIngs.length - 3} more</div>}
          </div>
        );
      })}
    </div>
  );
}

function SupplierDetail({ supplier, ingredients, recipes, onOpenPriceUpdate, onBack }) {
  if (!supplier) return null;
  const supplierIngs = getSupplierIngredients(supplier, ingredients);
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: fontSans, fontSize: 13, color: C.green, marginBottom: 16, padding: 0 }}>← Back to suppliers</button>
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontFamily: font, fontSize: 24, margin: 0 }}>{supplier.name}</h2>
          <Badge>{supplier.category}</Badge>
        </div>
        {supplier.contact && <div style={{ fontFamily: fontSans, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Contact: {supplier.contact}</div>}
        {supplier.notes && <div style={{ fontFamily: fontSans, fontSize: 13, color: C.textMuted }}>{supplier.notes}</div>}
      </div>
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Ingredients ({supplierIngs.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}>
            <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Ingredient</th>
            <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Current Price</th>
            <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Last Updated</th>
            <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>History</th>
            <th style={{ width: 80 }}></th>
          </tr></thead>
          <tbody>{supplierIngs.map(ing => {
            const h = ing.price_history || [];
            const lastEntry = h.length > 0 ? [...h].sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0] : null;
            return (
              <tr key={ing.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 6px" }}>{ing.name} <span style={{ color: C.textMuted, fontSize: 11 }}>/{ing.unit}</span></td>
                <td style={{ padding: "8px 6px", fontFamily: fontMono }}>€{ing.pricePerUnit.toFixed(2)}</td>
                <td style={{ padding: "8px 6px", color: C.textMuted, fontSize: 12 }}>{lastEntry ? lastEntry.effective_date : "—"}</td>
                <td style={{ padding: "8px 6px", fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>{h.length} entries</td>
                <td style={{ padding: "8px 6px" }}><Btn variant="secondary" onClick={() => onOpenPriceUpdate(ing)} style={{ fontSize: 11, padding: "4px 10px" }}>Update</Btn></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cost Drift Dashboard ────────────────────────────────────────
function CostDriftDashboard({ ingredients, recipes, suppliers, onOpenPriceUpdate }) {
  const [selectedIngId, setSelectedIngId] = useState(null);
  const [driftSort, setDriftSort] = useState({ key: "changePct", dir: "desc" });
  const summary = useMemo(() => computeDriftSummary(ingredients, recipes), [ingredients, recipes]);
  const drifts = useMemo(() => computeCostDrift(ingredients, recipes), [ingredients, recipes]);
  const erosions = useMemo(() => recipes.map(r => computeMarginErosion(r, ingredients)).filter(e => e.marginDelta < -1), [recipes, ingredients]);

  const sortedDrifts = useMemo(() => {
    const d = [...drifts];
    d.sort((a, b) => {
      let va, vb;
      if (driftSort.key === "name") { va = a.ingredient.name.toLowerCase(); vb = b.ingredient.name.toLowerCase(); }
      else if (driftSort.key === "changePct") { va = Math.abs(a.changePct); vb = Math.abs(b.changePct); }
      else { va = a[driftSort.key]; vb = b[driftSort.key]; }
      if (va < vb) return driftSort.dir === "asc" ? -1 : 1;
      if (va > vb) return driftSort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return d;
  }, [drifts, driftSort]);

  const selectedIng = selectedIngId ? ingredients.find(i => i.id === selectedIngId) : (drifts.length > 0 ? drifts[0].ingredient : null);
  const timeline = selectedIng ? getIngredientTimeline(selectedIng) : [];

  const toggleDriftSort = (key) => setDriftSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  const driftColHeader = (key, label) => (
    <th onClick={() => toggleDriftSort(key)} style={{ padding: 6, cursor: "pointer", color: C.textMuted, fontSize: 10, textTransform: "uppercase", userSelect: "none", whiteSpace: "nowrap", fontFamily: fontSans }}>
      {label} {driftSort.key === key ? (driftSort.dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, padding: 20, background: C.card, borderRadius: 10, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <Metric label="Tracked" value={summary.trackedCount} unit="" />
        <Metric label="Updates (90d)" value={summary.recentUpdates} unit="" />
        <Metric label="Avg change" value={`${summary.avgChangePct >= 0 ? "+" : ""}${summary.avgChangePct.toFixed(1)}`} unit="%" />
        <Metric label="Margin alerts" value={summary.marginAlerts} unit="" alert={summary.marginAlerts > 0} />
      </div>

      {/* Timeline chart */}
      {timeline.length > 1 && (
        <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Cost Timeline</div>
            <select value={selectedIng?.id || ""} onChange={e => setSelectedIngId(e.target.value)} style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: fontSans, fontSize: 12, background: C.cream }}>
              {ingredients.filter(i => i.price_history && i.price_history.length > 0).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeline} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <XAxis dataKey="date" tick={{ fontFamily: fontMono, fontSize: 10 }} />
              <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} />
              <Tooltip contentStyle={{ fontFamily: fontSans, fontSize: 12 }} />
              <Line type="stepAfter" dataKey="price" stroke={C.green} strokeWidth={2} dot={{ fill: C.green, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Drift table */}
      {sortedDrifts.length > 0 && (
        <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20, overflowX: "auto" }}>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Price Changes</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left" }}>
              {driftColHeader("name", "Ingredient")}
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Previous</th>
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Current</th>
              {driftColHeader("changePct", "Change")}
              <th style={{ padding: 6, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Recipes</th>
              <th style={{ width: 60 }}></th>
            </tr></thead>
            <tbody>{sortedDrifts.map(d => {
              const changeColor = d.changePct > 8 ? C.red : d.changePct > 3 ? C.amber : d.changePct < 0 ? C.green : C.textMuted;
              return (
                <tr key={d.ingredient.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 6px", fontWeight: 500 }}>{d.ingredient.name}</td>
                  <td style={{ padding: "8px 6px", fontFamily: fontMono, color: C.textMuted }}>€{d.previousPrice.toFixed(2)}</td>
                  <td style={{ padding: "8px 6px", fontFamily: fontMono }}>€{d.currentPrice.toFixed(2)}</td>
                  <td style={{ padding: "8px 6px", fontFamily: fontMono, fontWeight: 600, color: changeColor }}>{d.changePct >= 0 ? "+" : ""}{d.changePct.toFixed(1)}%</td>
                  <td style={{ padding: "8px 6px", fontFamily: fontMono, color: C.textMuted }}>{d.affectedRecipeCount}</td>
                  <td style={{ padding: "8px 6px" }}><button onClick={() => onOpenPriceUpdate(d.ingredient)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: fontSans, fontSize: 11, color: C.green }}>✎</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* Margin erosion */}
      {erosions.length > 0 && (
        <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Margin Erosion</div>
          {erosions.map(e => (
            <div key={e.recipe.id} style={{ padding: 14, background: C.amberPale, borderRadius: 8, border: `1px solid ${C.amber}30`, marginBottom: 10 }}>
              <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: C.amber, marginBottom: 6 }}>⚠ {e.recipe.name}</div>
              <div style={{ display: "flex", gap: 16, fontFamily: fontMono, fontSize: 12, marginBottom: 6 }}>
                <span>Original: {e.originalMargin.toFixed(1)}%</span>
                <span>Current: <strong style={{ color: e.currentMargin < e.recipe.targetMargin ? C.red : C.green }}>{e.currentMargin.toFixed(1)}%</strong></span>
                <span style={{ color: C.red }}>({e.marginDelta.toFixed(1)}%)</span>
              </div>
              {e.costDrivers.length > 0 && (
                <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted }}>
                  Primary cause: {e.costDrivers[0].ingredient.name} +{e.costDrivers[0].pctIncrease.toFixed(1)}%
                </div>
              )}
              {e.suggestedPrice > 0 && e.currentMargin < e.recipe.targetMargin && (
                <div style={{ fontFamily: fontSans, fontSize: 11, color: C.text, marginTop: 4 }}>
                  To restore {e.recipe.targetMargin}%: raise price to €{e.suggestedPrice.toFixed(2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sortedDrifts.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
          <div style={{ fontFamily: font, fontSize: 22, marginBottom: 8 }}>No price changes yet</div>
          <div style={{ fontFamily: fontSans, fontSize: 14 }}>Update ingredient prices to see cost drift analysis</div>
        </div>
      )}
    </>
  );
}

// ─── Alert Banner ────────────────────────────────────────────────
function AlertBanner({ alerts, onDismiss, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  if (alerts.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 900, maxWidth: 380, width: "100%" }}>
      {!expanded ? (
        <button onClick={() => setExpanded(true)} style={{ background: C.amber, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: C.shadowLg, display: "flex", alignItems: "center", gap: 6 }}>
          ⚠ {alerts.length} alert{alerts.length > 1 ? "s" : ""}
        </button>
      ) : (
        <div style={{ background: C.card, borderRadius: 10, boxShadow: C.shadowLg, border: `1px solid ${C.border}`, maxHeight: 300, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Alerts</span>
            <button onClick={() => setExpanded(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted }}>×</button>
          </div>
          {alerts.map(alert => {
            const isCritical = alert.severity === "critical";
            return (
              <div key={alert.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: isCritical ? C.redPale : "transparent" }}>
                <div style={{ fontFamily: fontSans, fontSize: 12, color: isCritical ? C.red : C.amber, marginBottom: 4 }}>{alert.message}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onDismiss(alert.id)} style={{ background: "none", border: "none", fontFamily: fontSans, fontSize: 11, color: C.textMuted, cursor: "pointer", padding: 0 }}>Dismiss</button>
                  <button onClick={() => { onNavigate(alert.type); setExpanded(false); }} style={{ background: "none", border: "none", fontFamily: fontSans, fontSize: 11, color: C.green, cursor: "pointer", padding: 0, fontWeight: 600 }}>Take action →</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Simulator Constants & Config ────────────────────────────────
const SIM_REVENUE_VARIANCE = 0.15;        // ±15% daily revenue variance
const SIM_TYPICAL_PERIOD_PCT = 0.85;      // 85% chance of typical period
const SIM_RECIPE_AVAILABILITY = 0.15;     // 15% chance a recipe is unavailable
const SIM_CATEGORY_CAPS = { Coffee: 40, Pastry: 15, Kombucha: 8 };
const SIM_CATEGORY_WEIGHTS = { Coffee: 3, Pastry: 1.5, Kombucha: 0.5 };
const SIM_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

const DEFAULT_SIM_CONFIG = {
  targetDailyRevenue: 350,
  openDaysPerWeek: 6,
  daysToSimulate: 30,
  staffWeekday: 1,
  staffWeekend: 2,
  hourlyRate: 5.50,
  typicalPeriod: "afternoon",
  weekendBoost: 1.3,
};

function SimulatorConfigModal({ config, onChange, onGenerate, onCancel, recipes }) {
  const inputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontMono, fontSize: 14, background: C.cream, boxSizing: "border-box" };
  const labelStyle = { fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 };
  const set = (k, v) => onChange({ ...config, [k]: v });
  const annualEstimate = config.targetDailyRevenue * config.openDaysPerWeek * 52;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <label>
          <span style={labelStyle}>CA journalier cible (€)</span>
          <input type="number" step="10" min="50" value={config.targetDailyRevenue} onChange={e => set("targetDailyRevenue", parseFloat(e.target.value) || 0)} style={inputStyle} />
        </label>
        <label>
          <span style={labelStyle}>Jours ouverts / semaine</span>
          <input type="number" step="1" min="1" max="7" value={config.openDaysPerWeek} onChange={e => set("openDaysPerWeek", parseInt(e.target.value) || 6)} style={inputStyle} />
        </label>
      </div>

      <div style={{ background: C.cream, borderRadius: 8, padding: 12, border: `1px solid ${C.border}`, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>{"CA annuel estimé :"}</span>
        <span style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 700, color: C.green }}>{"€"}{annualEstimate.toLocaleString("fr-FR")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <label>
          <span style={labelStyle}>{"Jours à simuler"}</span>
          <input type="number" step="1" min="7" max="90" value={config.daysToSimulate} onChange={e => set("daysToSimulate", parseInt(e.target.value) || 30)} style={inputStyle} />
        </label>
        <label>
          <span style={labelStyle}>{"Période typique"}</span>
          <select value={config.typicalPeriod} onChange={e => set("typicalPeriod", e.target.value)} style={inputStyle}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="full_day">Full Day</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <label>
          <span style={labelStyle}>Personnel semaine</span>
          <input type="number" step="1" min="1" max="10" value={config.staffWeekday} onChange={e => set("staffWeekday", parseInt(e.target.value) || 1)} style={inputStyle} />
        </label>
        <label>
          <span style={labelStyle}>Personnel weekend</span>
          <input type="number" step="1" min="1" max="10" value={config.staffWeekend} onChange={e => set("staffWeekend", parseInt(e.target.value) || 2)} style={inputStyle} />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <label>
          <span style={labelStyle}>{"Taux horaire (€/h)"}</span>
          <input type="number" step="0.50" min="0" value={config.hourlyRate} onChange={e => set("hourlyRate", parseFloat(e.target.value) || 0)} style={inputStyle} />
        </label>
        <label>
          <span style={labelStyle}>Facteur weekend (x)</span>
          <input type="number" step="0.1" min="1.0" max="2.0" value={config.weekendBoost} onChange={e => set("weekendBoost", parseFloat(e.target.value) || 1)} style={inputStyle} />
        </label>
      </div>

      {recipes.length === 0 && (
        <div style={{ fontFamily: fontSans, fontSize: 12, color: C.red, marginBottom: 14 }}>Aucune recette — ajoutez des recettes avant de simuler.</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} style={{ fontSize: 12 }}>Annuler</Btn>
        <Btn onClick={() => recipes.length > 0 && onGenerate(config)} style={{ fontSize: 12, opacity: recipes.length > 0 ? 1 : 0.5 }}>{"🎲 Générer"}</Btn>
      </div>
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange, allData, onImportData }) {
  const inputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontMono, fontSize: 14, background: C.cream, boxSizing: "border-box" };
  const fileInputRef = useRef(null);
  const [importConfirm, setImportConfirm] = useState(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estudantina-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed.ingredients) || !Array.isArray(parsed.recipes)) {
          alert("Invalid backup file: missing ingredients or recipes data.");
          return;
        }
        setImportConfirm(parsed);
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset so the same file can be re-selected
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <h2 style={{ fontFamily: font, fontSize: 24, margin: "0 0 20px" }}>Settings</h2>
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted }}>Supplier & Cost Tracking</div>
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Price spike alert threshold (%)</span>
          <input type="number" step="1" min="1" value={settings.priceSpikeThreshold} onChange={e => onChange({ ...settings, priceSpikeThreshold: parseFloat(e.target.value) || 5 })} style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Margin alert threshold (% below target)</span>
          <input type="number" step="1" min="1" value={settings.marginAlertThreshold} onChange={e => onChange({ ...settings, marginAlertThreshold: parseFloat(e.target.value) || 5 })} style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Price staleness warning after (days)</span>
          <input type="number" step="1" min="1" value={settings.stalePriceDays} onChange={e => onChange({ ...settings, stalePriceDays: parseInt(e.target.value) || 90 })} style={inputStyle} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <input type="checkbox" checked={settings.autoSnapshot} onChange={e => onChange({ ...settings, autoSnapshot: e.target.checked })} />
          <span style={{ fontFamily: fontSans, fontSize: 13 }}>Auto-snapshot on shift save</span>
        </label>
        <Btn variant="secondary" onClick={() => onChange(DEFAULT_SETTINGS)} style={{ fontSize: 12 }}>Reset to defaults</Btn>
      </div>

      {/* Data Management */}
      <div style={{ background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginTop: 20 }}>
        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted }}>Data Management</div>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Export your data as a backup or import a previous backup file.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn onClick={handleExport} style={{ fontSize: 12 }}>Export data (JSON)</Btn>
          <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12 }}>Import data</Btn>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFileSelect} />
        </div>
        {allData && (
          <div style={{ marginTop: 12, fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>
            {allData.ingredients?.length || 0} ingredients · {allData.recipes?.length || 0} recipes · {allData.shifts?.length || 0} shifts · {allData.suppliers?.length || 0} suppliers
          </div>
        )}
      </div>

      {/* Import confirmation modal */}
      {importConfirm && (
        <Modal open={true} onClose={() => setImportConfirm(null)} title="Confirm import">
          <div style={{ fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
            <p style={{ marginBottom: 12 }}>This will <strong>replace all</strong> your current data with:</p>
            <div style={{ background: C.cream, borderRadius: 6, padding: 12, fontFamily: fontMono, fontSize: 12 }}>
              <div>{importConfirm.ingredients?.length || 0} ingredients</div>
              <div>{importConfirm.recipes?.length || 0} recipes</div>
              <div>{importConfirm.shifts?.length || 0} shifts</div>
              <div>{importConfirm.suppliers?.length || 0} suppliers</div>
            </div>
            <p style={{ marginTop: 12, color: C.red, fontSize: 12 }}>This cannot be undone.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="secondary" onClick={() => setImportConfirm(null)} style={{ fontSize: 12 }}>Cancel</Btn>
            <Btn onClick={() => { onImportData(importConfirm); setImportConfirm(null); }} style={{ background: C.red, fontSize: 12 }}>Replace all data</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────
export default function App() {
  const [ingredients, setIngredients] = useState(DEFAULT_INGREDIENTS);
  const [recipes, setRecipes] = useState(DEFAULT_RECIPES);
  const [shifts, setShifts] = useState([]);
  const [view, setView] = useState("dashboard");
  const [shiftView, setShiftView] = useState("dashboard");
  const [editingShift, setEditingShift] = useState(null);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [menuSort, setMenuSort] = useState({ key: "totalQty", dir: "desc" });
  const [menuFilterCat, setMenuFilterCat] = useState("All");
  const [menuFilterQuadrant, setMenuFilterQuadrant] = useState("All");
  const [menuDateRange, setMenuDateRange] = useState("all");
  const [filter, setFilter] = useState("All");
  const [showIngModal, setShowIngModal] = useState(false);
  const [recipeModal, setRecipeModal] = useState({ open: false, recipe: null });
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const stRef = useRef(null);
  // v6 new state
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [alerts, setAlerts] = useState([]);
  const [fixedCosts, setFixedCosts] = useState([]);
  const [supplierView, setSupplierView] = useState("list"); // "list" | "detail" | "drift"
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [priceUpdateIngredient, setPriceUpdateIngredient] = useState(null);
  const [dashboardPeriod, setDashboardPeriod] = useState(30);
  // Simulator config
  const [simConfig, setSimConfig] = useState(null);
  const [simConfigSaved, setSimConfigSaved] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, needsMigration } = await loadData(store);
        if (data) {
          const d = needsMigration ? migrateToV6(data) : data;
          const rawIngs = d.ingredients?.length ? d.ingredients : DEFAULT_INGREDIENTS;
          const ings = ensurePriceHistory(rawIngs);
          // Always ensure suppliers exist (handles fresh install, migration, or stale v6)
          const { suppliers: resolvedSuppliers, ingredients: linkedIngs } = ensureSuppliers(ings, d.suppliers || []);
          setIngredients(linkedIngs);
          if (d.recipes?.length) setRecipes(d.recipes);
          if (d.shifts?.length) setShifts(d.shifts);
          if (d.shift_templates?.length) setShiftTemplates(d.shift_templates);
          setSuppliers(resolvedSuppliers);
          if (d.settings) setSettings(d.settings);
          if (d.alerts?.length) setAlerts(d.alerts);
          if (d.fixed_costs?.length) setFixedCosts(d.fixed_costs);
          if (d.dashboard_period) setDashboardPeriod(d.dashboard_period);
        } else {
          // Fresh install — no saved data, seed price history + extract suppliers from defaults
          const seededIngs = ensurePriceHistory(DEFAULT_INGREDIENTS);
          const { suppliers: defaultSuppliers, ingredients: linkedIngs } = ensureSuppliers(seededIngs, []);
          setIngredients(linkedIngs);
          setSuppliers(defaultSuppliers);
        }
      } catch (e) { console.warn(e); }
      // Load saved simulator config
      try { const sc = await store.get("estudantina-sim-config"); if (sc) setSimConfigSaved(JSON.parse(sc)); } catch {}
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await store.set(CURRENT_SK, JSON.stringify({ ingredients, recipes, shifts, shift_templates: shiftTemplates, suppliers, settings, alerts, fixed_costs: fixedCosts, dashboard_period: dashboardPeriod }));
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    clearTimeout(stRef.current); stRef.current = setTimeout(() => setSaveStatus(null), 2000);
  }, [ingredients, recipes, shifts, shiftTemplates, suppliers, settings, alerts, fixedCosts, dashboardPeriod]);

  useEffect(() => { if (!loaded) return; const t = setTimeout(() => persist(), 500); return () => clearTimeout(t); }, [ingredients, recipes, shifts, shiftTemplates, suppliers, settings, alerts, fixedCosts, dashboardPeriod, loaded, persist]);

  // Regenerate alerts when ingredients/recipes/settings change
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const newAlerts = generateAlerts(ingredients, recipes, settings);
      setAlerts(prev => mergeAlerts(prev, newAlerts));
    }, 600);
    return () => clearTimeout(t);
  }, [ingredients, recipes, settings, loaded]);

  const filtered = useMemo(() => { let r = recipes; if (filter !== "All") r = r.filter(x => x.category === filter); if (search) r = r.filter(x => x.name.toLowerCase().includes(search.toLowerCase())); return r; }, [recipes, filter, search]);
  const stats = useMemo(() => { let tm = 0, cp = 0, ac = 0; recipes.forEach(r => { const uc = calcUnitCost(r, ingredients); const m = getMargin(r.sellingPrice, uc); if (r.sellingPrice > 0) { tm += m; cp++; } if (m < r.targetMargin && r.sellingPrice > 0) ac++; }); return { avg: cp > 0 ? tm / cp : 0, alerts: ac, total: recipes.length }; }, [recipes, ingredients]);

  const handleSaveShift = (shift) => {
    const stamped = stampShiftSnapshots(shift, recipes, ingredients);
    if (editingShift) {
      setShifts(prev => editShift(prev, stamped.id, stamped));
    } else {
      setShifts(prev => addShift(prev, { ...stamped, id: uid() }));
    }
    setEditingShift(null);
    setShiftView("dashboard");
  };
  const handleDeleteShift = (id) => setShifts(prev => removeShift(prev, id));
  const handleEditShift = (shift) => { setEditingShift(shift); setShiftView("form"); };
  const handleNewShift = () => { setEditingShift(null); setShiftView("form"); };
  const handleSaveTemplate = (template) => setShiftTemplates(prev => [...prev, template]);
  const handleDeleteTemplate = (id) => setShiftTemplates(prev => prev.filter(t => t.id !== id));
  const handleLogAsReal = (shiftData) => {
    const stamped = stampShiftSnapshots(shiftData, recipes, ingredients);
    setShifts(prev => addShift(prev, { ...stamped, id: uid() }));
    setShiftView("dashboard");
  };
  const handlePriceUpdate = (updatedIngredient) => {
    setIngredients(prev => prev.map(i => i.id === updatedIngredient.id ? updatedIngredient : i));
    setPriceUpdateIngredient(null);
  };
  const handleDismissAlert = (alertId) => {
    setAlerts(prev => dismissAlertFn(prev, alertId));
  };
  const handleImportData = (data) => {
    const ings = ensurePriceHistory(data.ingredients || DEFAULT_INGREDIENTS);
    const { suppliers: resolvedSuppliers, ingredients: linkedIngs } = ensureSuppliers(ings, data.suppliers || []);
    setIngredients(linkedIngs);
    setRecipes(data.recipes || DEFAULT_RECIPES);
    setShifts(data.shifts || []);
    setShiftTemplates(data.shift_templates || []);
    setSuppliers(resolvedSuppliers);
    setSettings(data.settings || DEFAULT_SETTINGS);
    setAlerts(data.alerts || []);
    setFixedCosts(data.fixed_costs || []);
  };

  const openSimConfig = () => setSimConfig(simConfigSaved || { ...DEFAULT_SIM_CONFIG });

  const generateRandomShifts = async (config) => {
    const { targetDailyRevenue, openDaysPerWeek, daysToSimulate, staffWeekday,
            staffWeekend, hourlyRate, typicalPeriod, weekendBoost } = config;
    const periods = ["morning", "afternoon", "full_day"];
    // Closed days: Mon=1 first, then Tue=2, etc.
    const closedDays = SIM_DAY_ORDER.slice(0, 7 - openDaysPerWeek);

    const today = new Date();
    const newShifts = [];
    for (let i = 0; i < daysToSimulate; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();
      if (closedDays.includes(dayOfWeek)) continue;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const variance = 1 + (Math.random() * 2 - 1) * SIM_REVENUE_VARIANCE;
      const dayTarget = targetDailyRevenue * (isWeekend ? weekendBoost : 1.0) * variance;

      const period = Math.random() > SIM_TYPICAL_PERIOD_PCT ? periods[Math.floor(Math.random() * 3)] : typicalPeriod;
      const isFullDay = period === "full_day";
      const staffCount = isWeekend ? staffWeekend : staffWeekday;
      const hoursWorked = isFullDay ? (7 + Math.random() * 3) : (3 + Math.random() * 3);

      const available = recipes.filter(() => Math.random() > SIM_RECIPE_AVAILABILITY);
      if (available.length === 0) continue;
      const weights = available.map(r => {
        const catW = SIM_CATEGORY_WEIGHTS[r.category] || 0.5;
        return catW * (0.5 + Math.random());
      });
      const totalW = weights.reduce((a, b) => a + b, 0);
      const sales = [];
      for (let j = 0; j < available.length; j++) {
        const r = available[j];
        const share = (weights[j] / totalW) * dayTarget;
        const cap = SIM_CATEGORY_CAPS[r.category] || 10;
        const qty = Math.min(Math.round(share / r.sellingPrice), cap);
        if (qty > 0) sales.push({ recipe_id: r.id, quantity: qty });
      }
      if (sales.length === 0) continue;

      const rawShift = {
        id: uid(),
        date: d.toISOString().slice(0, 10),
        period,
        staff_count: staffCount,
        hours_worked: Math.round(hoursWorked * 2) / 2,
        hourly_rate: hourlyRate,
        sales,
        notes: isWeekend ? "Weekend" : "",
      };
      newShifts.push(stampShiftSnapshots(rawShift, recipes, ingredients));
    }
    setShifts(newShifts);
    setShiftView("dashboard");
    // Persist config
    try { await store.set("estudantina-sim-config", JSON.stringify(config)); setSimConfigSaved(config); } catch {}
  };

  const tabStyle = (active) => ({
    padding: "6px 16px", borderRadius: 6, border: "none",
    background: active ? "#fff" : "transparent",
    color: active ? C.green : "rgba(255,255,255,0.7)",
    fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: fontSans, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ background: C.green, color: "#fff", padding: "24px 24px 20px", borderBottom: "3px solid #1E3D28" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontFamily: font, fontSize: 28, fontWeight: 400, margin: 0, fontStyle: "italic" }}>Estudantina</h1>
              <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 2, overflowX: "auto" }}>
                <button onClick={() => setView("dashboard")} style={tabStyle(view === "dashboard")}>Dashboard</button>
                <button onClick={() => setView("recipes")} style={tabStyle(view === "recipes")}>Recipes</button>
                <button onClick={() => { setView("shifts"); setShiftView("dashboard"); }} style={tabStyle(view === "shifts")}>Shifts</button>
                <button onClick={() => setView("menu")} style={tabStyle(view === "menu")}>Menu</button>
                <button onClick={() => setView("charges")} style={tabStyle(view === "charges")}>Charges</button>
                <button onClick={() => { setView("suppliers"); setSupplierView("list"); }} style={tabStyle(view === "suppliers")}>
                  Suppliers{getActiveAlertCount(alerts) > 0 && <span style={{ marginLeft: 4, background: C.red, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 700 }}>{getActiveAlertCount(alerts)}</span>}
                </button>
                <button onClick={() => setView("settings")} style={tabStyle(view === "settings")}>Settings</button>
              </div>
              <SaveIndicator status={saveStatus} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {view === "dashboard" ? (
                <>
                  <Btn variant="secondary" onClick={openSimConfig} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 11 }}>🎲 Simulate 30 days</Btn>
                  <Btn onClick={() => { setView("shifts"); handleNewShift(); }} style={{ background: "#fff", color: C.green, fontSize: 12 }}>+ Log shift</Btn>
                </>
              ) : view === "recipes" ? (
                <>
                  <Btn variant="secondary" onClick={() => { setIngredients(DEFAULT_INGREDIENTS); setRecipes(DEFAULT_RECIPES); }} style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.15)", fontSize: 11 }}>↺ Reset</Btn>
                  <Btn variant="secondary" onClick={() => setShowIngModal(true)} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 12 }}>📦 Ingredients ({ingredients.length})</Btn>
                  <Btn onClick={() => setRecipeModal({ open: true, recipe: null })} style={{ background: "#fff", color: C.green, fontSize: 12 }}>+ New recipe</Btn>
                </>
              ) : view === "shifts" ? (
                <>
                  <Btn variant="secondary" onClick={openSimConfig} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 11 }}>{"\uD83C\uDFB2"} Simulate 30 days</Btn>
                  <Btn onClick={handleNewShift} style={{ background: "#fff", color: C.green, fontSize: 12 }}>+ Log shift</Btn>
                </>
              ) : view === "suppliers" ? (
                <>
                  {supplierView === "list" && <Btn variant="secondary" onClick={() => setSupplierView("drift")} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 11 }}>📊 Cost Drift</Btn>}
                  {supplierView === "drift" && <Btn variant="secondary" onClick={() => setSupplierView("list")} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 11 }}>← Suppliers</Btn>}
                  {supplierView === "detail" && <Btn variant="secondary" onClick={() => { setSupplierView("list"); setSelectedSupplierId(null); }} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", fontSize: 11 }}>← Suppliers</Btn>}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 40px" }}>
        {view === "dashboard" ? (
          <Dashboard shifts={shifts} recipes={recipes} ingredients={ingredients} alerts={alerts} fixedCosts={fixedCosts} dashboardPeriod={dashboardPeriod} onChangePeriod={setDashboardPeriod} onLogShift={() => { setView("shifts"); handleNewShift(); }} onSimulate={openSimConfig} onNavigate={setView} />
        ) : view === "recipes" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, padding: 20, background: C.card, borderRadius: 10, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              <Metric label="Recipes" value={stats.total} unit="" /><Metric label="Avg. margin" value={stats.avg.toFixed(1)} unit="%" /><Metric label="Alerts" value={stats.alerts} unit="" alert={stats.alerts > 0} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 6 }}>{["All", ...CATEGORIES].map(c => <button key={c} onClick={() => setFilter(c)} style={{ padding: "6px 14px", borderRadius: 20, border: filter === c ? "none" : `1px solid ${C.border}`, background: filter === c ? C.green : "transparent", color: filter === c ? "#fff" : C.textMuted, fontFamily: fontSans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>)}</div>
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 20, fontFamily: fontSans, fontSize: 12, background: C.card, outline: "none", width: 160 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>{filtered.map(r => <RecipeCard key={r.id} recipe={r} ingredients={ingredients} onEdit={rec => setRecipeModal({ open: true, recipe: rec })} onDelete={id => setRecipes(prev => prev.filter(x => x.id !== id))} />)}</div>
            {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}><Btn onClick={() => setRecipeModal({ open: true, recipe: null })} style={{ marginTop: 12 }}>+ Create a recipe</Btn></div>}
          </>
        ) : view === "shifts" ? (
          shiftView === "dashboard" ? (
            <ShiftDashboard shifts={shifts} recipes={recipes} ingredients={ingredients} onEdit={handleEditShift} onDelete={handleDeleteShift} onNew={handleNewShift} />
          ) : (
            <ShiftForm shift={editingShift} recipes={recipes} ingredients={ingredients} onSave={handleSaveShift} onCancel={() => { setEditingShift(null); setShiftView("dashboard"); }} shiftTemplates={shiftTemplates} onSaveTemplate={handleSaveTemplate} onDeleteTemplate={handleDeleteTemplate} onLogAsReal={handleLogAsReal} />
          )
        ) : view === "suppliers" ? (
          supplierView === "drift" ? (
            <CostDriftDashboard ingredients={ingredients} recipes={recipes} suppliers={suppliers} onOpenPriceUpdate={setPriceUpdateIngredient} />
          ) : supplierView === "detail" && selectedSupplierId ? (
            <SupplierDetail supplier={suppliers.find(s => s.id === selectedSupplierId)} ingredients={ingredients} recipes={recipes} onOpenPriceUpdate={setPriceUpdateIngredient} onBack={() => { setSupplierView("list"); setSelectedSupplierId(null); }} />
          ) : (
            <SupplierList suppliers={suppliers} ingredients={ingredients} onSelectSupplier={(id) => { setSelectedSupplierId(id); setSupplierView("detail"); }} />
          )
        ) : view === "charges" ? (
          <FixedChargesPanel fixedCosts={fixedCosts} onChangeFixedCosts={setFixedCosts} shifts={shifts} recipes={recipes} ingredients={ingredients} />
        ) : view === "settings" ? (
          <SettingsPanel settings={settings} onChange={setSettings} allData={{ ingredients, recipes, shifts, shift_templates: shiftTemplates, suppliers, settings, alerts, fixed_costs: fixedCosts }} onImportData={handleImportData} />
        ) : (
          <MenuPerformanceView recipes={recipes} ingredients={ingredients} shifts={shifts} menuSort={menuSort} setMenuSort={setMenuSort} menuFilterCat={menuFilterCat} setMenuFilterCat={setMenuFilterCat} menuFilterQuadrant={menuFilterQuadrant} setMenuFilterQuadrant={setMenuFilterQuadrant} menuDateRange={menuDateRange} setMenuDateRange={setMenuDateRange} onNavigateToShifts={() => { setView("shifts"); setShiftView("dashboard"); }} />
        )}
        {/* Alert Banner */}
        {alerts.filter(a => !a.dismissed).length > 0 && view !== "settings" && (
          <AlertBanner alerts={alerts.filter(a => !a.dismissed)} onDismiss={handleDismissAlert} onNavigate={(type) => { if (type === "price_spike" || type === "stale_price") { setView("suppliers"); setSupplierView("list"); } else { setView("recipes"); } }} />
        )}
      </div>
      <IngredientModal open={showIngModal} onClose={() => setShowIngModal(false)} ingredients={ingredients} onSave={setIngredients} onOpenPriceUpdate={setPriceUpdateIngredient} />
      <RecipeModal open={recipeModal.open} onClose={() => setRecipeModal({ open: false, recipe: null })} recipe={recipeModal.recipe} ingredients={ingredients} onSave={rec => setRecipes(prev => { const idx = prev.findIndex(r => r.id === rec.id); if (idx >= 0) { const c = [...prev]; c[idx] = rec; return c; } return [...prev, rec]; })} />
      <PriceUpdateModal ingredient={priceUpdateIngredient} recipes={recipes} ingredients={ingredients} onSave={handlePriceUpdate} onClose={() => setPriceUpdateIngredient(null)} />
      {simConfig && (
        <Modal open onClose={() => setSimConfig(null)} title="Configuration de la simulation">
          <SimulatorConfigModal config={simConfig} onChange={setSimConfig} onGenerate={(cfg) => { generateRandomShifts(cfg); setSimConfig(null); }} onCancel={() => setSimConfig(null)} recipes={recipes} />
        </Modal>
      )}
    </div>
  );
}
