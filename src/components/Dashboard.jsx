import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { C, font, fontMono, fontSans, Badge, Metric, Btn, catColors } from "./shared.jsx";
import {
  getDailyRevenue, getWeekdayBreakdown, getTopSellers,
  getFoodCostPct, getTodaySnapshot, getQuickStats, getMarginTrend,
  filterShiftsByDays, computeDailyFixedCost, computeBreakEvenRevenue,
} from "../services/analyticsService.js";
import { THRESHOLDS } from "../utils/shiftMetrics.js";

const card = { background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 };
const sectionTitle = { fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted };

export default function Dashboard({ shifts, recipes, ingredients, alerts, fixedCosts, onLogShift, onSimulate, onNavigate }) {
  const quickStats = useMemo(() => getQuickStats(recipes, ingredients, alerts), [recipes, ingredients, alerts]);
  const foodCostPct = useMemo(() => getFoodCostPct(shifts, recipes, ingredients), [shifts, recipes, ingredients]);
  const todaySnap = useMemo(() => getTodaySnapshot(shifts, recipes, ingredients), [shifts, recipes, ingredients]);
  const weeklyRevenue = useMemo(() => getDailyRevenue(shifts, recipes, ingredients, 7), [shifts, recipes, ingredients]);
  const marginTrend = useMemo(() => getMarginTrend(shifts, recipes, ingredients, 30), [shifts, recipes, ingredients]);
  const topSellers = useMemo(() => {
    const recent = filterShiftsByDays(shifts, 7);
    return getTopSellers(recent, recipes, ingredients, 5);
  }, [shifts, recipes, ingredients]);
  const weekdayData = useMemo(() => getWeekdayBreakdown(shifts, recipes, ingredients), [shifts, recipes, ingredients]);

  // Fixed costs
  const fc = fixedCosts || [];
  const fixedCostData = useMemo(() => computeDailyFixedCost(fc), [fc]);
  const breakEvenData = useMemo(() => computeBreakEvenRevenue(shifts, recipes, ingredients, fc), [shifts, recipes, ingredients, fc]);
  const hasFixedCosts = fixedCostData.monthlyTotal > 0;

  // Empty state
  if (shifts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
        <h2 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, marginBottom: 8 }}>Welcome to Estudantina</h2>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: C.textMuted, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
          Log your first shift or simulate 30 days of data to see business insights here.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn onClick={onLogShift}>+ Log a shift</Btn>
          <Btn variant="secondary" onClick={onSimulate}>Simulate 30 days</Btn>
        </div>
      </div>
    );
  }

  const ttStyle = { contentStyle: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: fontSans, fontSize: 12 } };

  return (
    <>
      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, ...card }}>
        <Metric label="Recipes" value={quickStats.totalRecipes} unit="" />
        <Metric label="Avg. margin" value={quickStats.avgMargin.toFixed(1)} unit="%" />
        <Metric label="Food cost" value={foodCostPct.toFixed(1)} unit="%" alert={foodCostPct > 35} />
        <Metric label="Alerts" value={quickStats.activeAlerts} unit="" alert={quickStats.activeAlerts > 0} />
        {hasFixedCosts && (
          <>
            <Metric label="Daily overhead" value={`€${fixedCostData.dailyCost.toFixed(0)}`} unit="" />
            {breakEvenData && <Metric label="Break-even" value={`€${breakEvenData.breakEvenRevenue.toFixed(0)}`} unit="/day" />}
          </>
        )}
      </div>

      {/* Today's Snapshot */}
      <div style={card}>
        <div style={sectionTitle}>Today</div>
        {todaySnap ? (
          hasFixedCosts ? (
            /* Full P&L with fixed costs */
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
                <Metric label="Revenue" value={`€${todaySnap.revenue.toFixed(0)}`} unit="" />
                <Metric label="COGS" value={`€${todaySnap.cogs.toFixed(0)}`} unit="" />
                <Metric label="Gross profit" value={`€${todaySnap.grossProfit.toFixed(0)}`} unit="" />
                <Metric label="Labor" value={`€${todaySnap.laborCost.toFixed(0)}`} unit="" />
                <Metric label="Food cost" value={todaySnap.foodCostPct.toFixed(1)} unit="%" alert={todaySnap.foodCostPct > 35} />
              </div>
              {/* P&L waterfall */}
              <div style={{ background: C.cream, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted, marginBottom: 10 }}>P&L Breakdown</div>
                {(() => {
                  const operatingProfit = todaySnap.netProfit; // revenue - cogs - labor
                  const dailyFixed = fixedCostData.dailyCost;
                  const trueNetProfit = operatingProfit - dailyFixed;
                  const rows = [
                    { label: "Revenue", value: todaySnap.revenue, sign: "" },
                    { label: "COGS", value: -todaySnap.cogs, sign: "-" },
                    { label: "Gross Profit", value: todaySnap.grossProfit, sign: "", bold: false, line: true },
                    { label: "Labor", value: -todaySnap.laborCost, sign: "-" },
                    { label: "Operating Profit", value: operatingProfit, sign: "", bold: false, line: true },
                    { label: "Fixed Costs", value: -dailyFixed, sign: "-" },
                    { label: "Net Profit", value: trueNetProfit, sign: "", bold: true, line: true, final: true },
                  ];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {rows.map((r, i) => (
                        <div key={i}>
                          {r.line && <div style={{ borderTop: r.final ? `2px solid ${C.text}` : `1px solid ${C.border}`, marginBottom: 6, marginTop: 2 }} />}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                            <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: r.bold ? 700 : 400, color: r.final ? (r.value >= 0 ? C.green : C.red) : C.text }}>{r.label}</span>
                            <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: r.bold ? 700 : 400, color: r.value < 0 ? C.red : (r.final ? C.green : C.text) }}>
                              {r.value < 0 ? `-€${Math.abs(r.value).toFixed(0)}` : `€${r.value.toFixed(0)}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* Original layout without fixed costs */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              <Metric label="Revenue" value={`€${todaySnap.revenue.toFixed(0)}`} unit="" />
              <Metric label="COGS" value={`€${todaySnap.cogs.toFixed(0)}`} unit="" />
              <Metric label="Gross profit" value={`€${todaySnap.grossProfit.toFixed(0)}`} unit="" />
              <Metric label="Net profit" value={`€${todaySnap.netProfit.toFixed(0)}`} unit="" alert={todaySnap.netProfit < 0} />
              <Metric label="Food cost" value={todaySnap.foodCostPct.toFixed(1)} unit="%" alert={todaySnap.foodCostPct > 35} />
            </div>
          )
        ) : (
          <div style={{ fontFamily: fontSans, fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 12 }}>
            No shifts logged today
            <Btn onClick={onLogShift} style={{ fontSize: 11, padding: "4px 12px" }}>+ Log a shift</Btn>
          </div>
        )}
      </div>

      {/* Weekly Revenue Chart */}
      <div style={card}>
        <div style={sectionTitle}>Revenue — Last 7 days</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyRevenue} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="dayName" tick={{ fontFamily: fontMono, fontSize: 11 }} />
            <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `€${v}`} />
            <Tooltip {...ttStyle} formatter={(v) => [`€${Number(v).toFixed(2)}`, ""]} />
            {hasFixedCosts && breakEvenData && (
              <ReferenceLine y={breakEvenData.breakEvenRevenue} stroke={C.amber} strokeDasharray="5 5" label={{ value: `BE €${breakEvenData.breakEvenRevenue.toFixed(0)}`, position: "insideTopRight", fontFamily: fontMono, fontSize: 10, fill: C.amber }} />
            )}
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {weeklyRevenue.map((entry, i) => {
                const dayProfit = hasFixedCosts ? entry.netProfit - fixedCostData.dailyCost : entry.netProfit;
                return (
                  <Cell key={i} fill={dayProfit >= 0 ? C.green : C.red} opacity={entry.revenue === 0 ? 0.15 : 0.85} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 30-Day Margin Trend */}
      {marginTrend.length > 1 && (
        <div style={card}>
          <div style={sectionTitle}>Gross margin trend — 30 days</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={marginTrend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip {...ttStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Margin"]} />
              <ReferenceLine y={THRESHOLDS.MIN_GROSS_MARGIN} stroke={C.amber} strokeDasharray="5 5" label={{ value: `${THRESHOLDS.MIN_GROSS_MARGIN}%`, position: "insideTopRight", fontFamily: fontMono, fontSize: 10, fill: C.amber }} />
              <Line type="monotone" dataKey="marginPct" stroke={C.green} strokeWidth={2} dot={{ r: 3, fill: C.green }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two-column: Top Sellers + Day of Week */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Top 5 This Week */}
        <div style={card}>
          <div style={sectionTitle}>Top sellers — This week</div>
          {topSellers.length === 0 ? (
            <div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>No sales data for this week</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topSellers.map((item, i) => {
                const cc = catColors[item.category] || { bg: C.greenPale, color: C.green };
                return (
                  <div key={item.recipeId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topSellers.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 700, color: C.textMuted, width: 24, textAlign: "center" }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted }}>{item.totalQty} units · <span style={{ color: cc.color }}>{item.category}</span></div>
                    </div>
                    <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 600 }}>€{item.totalRevenue.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Day-of-Week Performance */}
        <div style={card}>
          <div style={sectionTitle}>Avg revenue by day</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekdayData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontFamily: fontMono, fontSize: 11 }} />
              <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `€${v}`} />
              <Tooltip {...ttStyle} formatter={(v, name) => [`€${Number(v).toFixed(0)}`, name === "avgRevenue" ? "Avg Revenue" : "Avg Net Profit"]} />
              <Bar dataKey="avgRevenue" fill={C.green} radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
