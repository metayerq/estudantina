import { useState, useMemo } from "react";
import { C, font, fontMono, fontSans, Metric, Btn, Modal, PLWaterfall, uid } from "./shared.jsx";
import { computeDailyFixedCost, computeBreakEvenRevenue } from "../services/analyticsService.js";

const FIXED_COST_CATEGORIES = ["Rent", "Utilities", "Insurance", "Maintenance", "Marketing", "Subscriptions", "Other"];
const FIXED_COST_FREQUENCIES = [{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "annual", label: "Annual" }];

const CATEGORY_ICONS = {
  Rent: "\uD83C\uDFE0", Utilities: "\u26A1", Insurance: "\uD83D\uDEE1\uFE0F",
  Maintenance: "\uD83D\uDD27", Marketing: "\uD83D\uDCE3", Subscriptions: "\uD83D\uDCCB", Other: "\uD83D\uDCCC",
};

const card = { background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 };
const sectionTitle = { fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted };

function toMonthly(fc) {
  if (fc.frequency === "monthly") return fc.amount;
  if (fc.frequency === "quarterly") return fc.amount / 3;
  if (fc.frequency === "annual") return fc.amount / 12;
  return fc.amount;
}

function FixedCostForm({ cost, onSave, onCancel }) {
  const [f, setF] = useState({ ...cost, amount: cost.amount || "" });
  const inputStyle = { width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: fontMono, fontSize: 14, background: C.cream, boxSizing: "border-box" };
  const valid = f.name.trim() && parseFloat(f.amount) > 0;
  return (
    <div>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Name</span>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Loyer mensuel" style={inputStyle} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <label>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>{"Amount (\u20AC)"}</span>
          <input type="number" step="0.01" min="0" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} style={inputStyle} />
        </label>
        <label>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Frequency</span>
          <select value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value })} style={inputStyle}>
            {FIXED_COST_FREQUENCIES.map(fr => <option key={fr.value} value={fr.value}>{fr.label}</option>)}
          </select>
        </label>
      </div>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Category</span>
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} style={inputStyle}>
          {FIXED_COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4 }}>Notes (optional)</span>
        <input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} style={inputStyle} />
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</Btn>
        <Btn onClick={() => valid && onSave({ ...f, amount: parseFloat(f.amount) || 0 })} style={{ fontSize: 12, opacity: valid ? 1 : 0.5 }}>
          {cost.id ? "Update" : "Add"}
        </Btn>
      </div>
    </div>
  );
}

export default function FixedChargesPanel({ fixedCosts, onChangeFixedCosts, shifts, recipes, ingredients }) {
  const [editingFC, setEditingFC] = useState(null);
  const fc = fixedCosts || [];

  const fixedCostData = useMemo(() => computeDailyFixedCost(fc), [fc]);
  const breakEvenData = useMemo(() => computeBreakEvenRevenue(shifts, recipes, ingredients, fc), [shifts, recipes, ingredients, fc]);
  const annualTotal = fixedCostData.monthlyTotal * 12;

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const item of fc) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    // Sort categories by total monthly descending
    return Object.entries(groups)
      .map(([cat, items]) => {
        const monthlySum = items.filter(i => i.active).reduce((s, i) => s + toMonthly(i), 0);
        return { category: cat, items, monthlySum };
      })
      .sort((a, b) => b.monthlySum - a.monthlySum);
  }, [fc]);

  const saveFC = (cost) => {
    if (cost.id) {
      onChangeFixedCosts(prev => prev.map(x => x.id === cost.id ? cost : x));
    } else {
      onChangeFixedCosts(prev => [...prev, { ...cost, id: `fc_${uid()}` }]);
    }
    setEditingFC(null);
  };
  const deleteFC = (id) => onChangeFixedCosts(prev => prev.filter(x => x.id !== id));
  const toggleActiveFC = (id) => onChangeFixedCosts(prev => prev.map(x => x.id === id ? { ...x, active: !x.active } : x));
  const blankFC = () => ({ id: "", name: "", amount: "", frequency: "monthly", category: "Other", active: true, notes: "" });

  const smallBtnStyle = { background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: fontSans, fontSize: 11, color: C.textMuted };

  return (
    <>
      <h2 style={{ fontFamily: font, fontSize: 24, margin: "0 0 20px" }}>Fixed Charges</h2>

      {/* Summary */}
      <div style={card}>
        <div style={sectionTitle}>Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Metric label="Monthly total" value={`\u20AC${fixedCostData.monthlyTotal.toFixed(0)}`} unit="" />
          <Metric label="Annual total" value={`\u20AC${annualTotal.toFixed(0)}`} unit="" />
          <Metric label="Daily allocation" value={`\u20AC${fixedCostData.dailyCost.toFixed(0)}`} unit="/day" />
          {breakEvenData && (
            <>
              <Metric label="Break-even" value={`\u20AC${breakEvenData.breakEvenRevenue.toFixed(0)}`} unit="/day" />
              <Metric label="Avg gross margin" value={breakEvenData.avgGrossMarginPct.toFixed(1)} unit="%" />
            </>
          )}
        </div>
      </div>

      {/* Category Groups */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={sectionTitle}>{"By Category"}</div>
          <Btn variant="secondary" onClick={() => setEditingFC(blankFC())} style={{ fontSize: 12 }}>+ Add fixed cost</Btn>
        </div>

        {fc.length === 0 && (
          <div style={{ fontFamily: fontSans, fontSize: 13, color: C.textMuted, padding: "20px 0", textAlign: "center" }}>
            No fixed costs configured yet. Add your rent, utilities, and other recurring costs to see true profitability.
          </div>
        )}

        {grouped.map(({ category, items, monthlySum }) => (
          <div key={category} style={{ marginBottom: 16 }}>
            {/* Category header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.cream, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 8 }}>
              <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>
                {CATEGORY_ICONS[category] || "\uD83D\uDCCC"} {category}
              </span>
              <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 600, color: C.green }}>
                {`\u20AC${monthlySum.toFixed(0)}/mo`}
              </span>
            </div>
            {/* Items */}
            {items.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, opacity: item.active ? 1 : 0.4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>
                    {`\u20AC${item.amount.toFixed(2)} / ${item.frequency}`}
                    {item.notes ? ` \u2014 ${item.notes}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => toggleActiveFC(item.id)} style={smallBtnStyle}>{item.active ? "Disable" : "Enable"}</button>
                  <button onClick={() => setEditingFC(item)} style={smallBtnStyle}>Edit</button>
                  <button onClick={() => deleteFC(item.id)} style={{ ...smallBtnStyle, color: C.red }}>{"\u00D7"}</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Break-even Impact */}
      {breakEvenData && (
        <div style={card}>
          <div style={sectionTitle}>Break-even Impact</div>
          <div style={{ background: C.cream, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: fontSans, fontSize: 13, marginBottom: 12 }}>
              To cover all costs (labor + fixed), you need at least <span style={{ fontFamily: fontMono, fontWeight: 700, color: C.amber }}>{`\u20AC${breakEvenData.breakEvenRevenue.toFixed(0)}`}</span> in daily revenue.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              <Metric label="Break-even revenue" value={`\u20AC${breakEvenData.breakEvenRevenue.toFixed(0)}`} unit="/day" size="small" />
              <Metric label="Avg daily labor" value={`\u20AC${breakEvenData.avgDailyLabor.toFixed(0)}`} unit="/day" size="small" />
              <Metric label="Daily fixed costs" value={`\u20AC${breakEvenData.dailyFixedCost.toFixed(0)}`} unit="/day" size="small" />
              <Metric label="Gross margin" value={breakEvenData.avgGrossMarginPct.toFixed(1)} unit="%" size="small" />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingFC && (
        <Modal open={true} onClose={() => setEditingFC(null)} title={editingFC.id ? "Edit fixed cost" : "Add fixed cost"}>
          <FixedCostForm cost={editingFC} onSave={saveFC} onCancel={() => setEditingFC(null)} />
        </Modal>
      )}
    </>
  );
}
