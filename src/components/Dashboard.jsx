import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { C, font, fontMono, fontSans, Badge, Metric, Btn, PLWaterfall, catColors } from "./shared.jsx";
import {
  getDailyRevenue, getWeekdayBreakdown, getTopSellers,
  getFoodCostPct, getTodaySnapshot, getQuickStats, getMarginTrend,
  filterShiftsByDays, computeDailyFixedCost, computeBreakEvenRevenue,
  getPeriodPL, getDetailedPLBreakdown, getPeriodComparison, getBestWorstShifts,
} from "../services/analyticsService.js";
import { THRESHOLDS } from "../utils/shiftMetrics.js";

const card = { background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 };
const sectionTitle = { fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted };

const PERIOD_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "3m" },
  { value: 180, label: "6m" },
  { value: 365, label: "1y" },
];

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", full_day: "Full Day" };
const PERIOD_ICONS = { morning: "🌅", afternoon: "☀️", full_day: "📋" };

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function periodLabel(days) {
  const opt = PERIOD_OPTIONS.find(o => o.value === days);
  return opt ? opt.label : `${days}d`;
}

export default function Dashboard({ shifts, recipes, ingredients, alerts, fixedCosts, dashboardPeriod, onChangePeriod, onLogShift, onSimulate, onNavigate }) {
  const period = dashboardPeriod || 30;

  // Core data
  const quickStats = useMemo(() => getQuickStats(recipes, ingredients, alerts), [recipes, ingredients, alerts]);
  const foodCostPct = useMemo(() => getFoodCostPct(shifts, recipes, ingredients), [shifts, recipes, ingredients]);
  const todaySnap = useMemo(() => getTodaySnapshot(shifts, recipes, ingredients), [shifts, recipes, ingredients]);

  // Period-aware data
  const dailyRevenue = useMemo(() => getDailyRevenue(shifts, recipes, ingredients, period), [shifts, recipes, ingredients, period]);
  const marginTrend = useMemo(() => getMarginTrend(shifts, recipes, ingredients, period), [shifts, recipes, ingredients, period]);
  const topSellers = useMemo(() => {
    const recent = filterShiftsByDays(shifts, period);
    return getTopSellers(recent, recipes, ingredients, 5);
  }, [shifts, recipes, ingredients, period]);
  const weekdayData = useMemo(() => getWeekdayBreakdown(shifts, recipes, ingredients), [shifts, recipes, ingredients]);

  // Period P&L
  const fc = fixedCosts || [];
  const fixedCostData = useMemo(() => computeDailyFixedCost(fc), [fc]);
  const breakEvenData = useMemo(() => computeBreakEvenRevenue(shifts, recipes, ingredients, fc), [shifts, recipes, ingredients, fc]);
  const hasFixedCosts = fixedCostData.monthlyTotal > 0;
  const periodPL = useMemo(() => getPeriodPL(shifts, recipes, ingredients, fc, period), [shifts, recipes, ingredients, fc, period]);
  const plBreakdown = useMemo(() => getDetailedPLBreakdown(shifts, recipes, ingredients, fc, period), [shifts, recipes, ingredients, fc, period]);

  // Absorbed from ShiftAnalytics
  const periodShifts = useMemo(() => filterShiftsByDays(shifts, period), [shifts, period]);
  const periodComp = useMemo(() => getPeriodComparison(periodShifts, recipes, ingredients), [periodShifts, recipes, ingredients]);
  const bestWorst = useMemo(() => getBestWorstShifts(periodShifts, recipes, ingredients), [periodShifts, recipes, ingredients]);

  // Empty state
  if (shifts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
        <h2 style={{ fontFamily: font, fontSize: 24, fontWeight: 600, marginBottom: 8, color: C.text }}>Welcome to Café Pilot</h2>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: C.textMuted, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
          Log your first shift or simulate 30 days of data to see your business insights.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn onClick={onLogShift}>+ Log a shift</Btn>
          <Btn variant="secondary" onClick={onSimulate}>Simulate 30 days</Btn>
        </div>
      </div>
    );
  }

  const ttStyle = { contentStyle: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: fontSans, fontSize: 12 } };

  // P&L waterfall rows
  const plRows = [
    { label: "Revenue", value: periodPL.totalRevenue },
    { label: "COGS", value: -periodPL.totalCogs },
    { label: "Gross Profit", value: periodPL.totalGross, line: true },
    { label: "Labor", value: -periodPL.totalLabor },
    { label: "Operating Profit", value: periodPL.operatingProfit, line: true },
  ];
  if (hasFixedCosts) {
    plRows.push({ label: "Fixed Costs", value: -periodPL.fixedCostAllocation });
  }
  plRows.push({ label: "Net Profit", value: hasFixedCosts ? periodPL.netProfit : periodPL.operatingProfit, bold: true, line: true, final: true });

  return (
    <>
      {/* Period Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 2, background: C.card, borderRadius: 6, padding: 2, border: `1px solid ${C.border}` }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => onChangePeriod(opt.value)} style={{
              padding: "5px 14px", borderRadius: 4, border: "none",
              background: period === opt.value ? C.text : "transparent",
              color: period === opt.value ? "#fff" : C.textMuted,
              fontFamily: fontSans, fontSize: 12, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s ease",
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, ...card }}>
        <Metric label="Recipes" value={quickStats.totalRecipes} unit="" />
        <Metric label="Avg. margin" value={quickStats.avgMargin.toFixed(1)} unit="%" />
        <Metric label="Food cost" value={foodCostPct.toFixed(1)} unit="%" alert={foodCostPct > THRESHOLDS.MAX_FOOD_COST_PCT} />
        <Metric label="Alerts" value={quickStats.activeAlerts} unit="" alert={quickStats.activeAlerts > 0} />
        <Metric label="CA annuel est." value={`€${(periodPL.annualizedRevenue / 1000).toFixed(0)}k`} unit="" />
        {hasFixedCosts && breakEvenData && (
          <Metric label="Break-even" value={`€${breakEvenData.breakEvenRevenue.toFixed(0)}`} unit="/day" />
        )}
      </div>

      {/* Today's Snapshot */}
      <div style={card}>
        <div style={sectionTitle}>Today</div>
        {todaySnap ? (
          hasFixedCosts ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
                <Metric label="Revenue" value={`€${todaySnap.revenue.toFixed(0)}`} unit="" />
                <Metric label="COGS" value={`€${todaySnap.cogs.toFixed(0)}`} unit="" />
                <Metric label="Gross profit" value={`€${todaySnap.grossProfit.toFixed(0)}`} unit="" />
                <Metric label="Labor" value={`€${todaySnap.laborCost.toFixed(0)}`} unit="" />
                <Metric label="Food cost" value={todaySnap.foodCostPct.toFixed(1)} unit="%" alert={todaySnap.foodCostPct > THRESHOLDS.MAX_FOOD_COST_PCT} />
              </div>
              <div style={{ background: C.cream, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted, marginBottom: 10 }}>{"P&L Breakdown"}</div>
                <PLWaterfall rows={(() => {
                  // todaySnap.netProfit = gross_profit - labor_cost (operating profit, no fixed costs)
                  const operatingProfit = todaySnap.netProfit;
                  const dailyFixed = fixedCostData.dailyCost;
                  const trueNetProfit = operatingProfit - dailyFixed;
                  return [
                    { label: "Revenue", value: todaySnap.revenue },
                    { label: "COGS", value: -todaySnap.cogs },
                    { label: "Gross Profit", value: todaySnap.grossProfit, line: true },
                    { label: "Labor", value: -todaySnap.laborCost },
                    { label: "Operating Profit", value: operatingProfit, line: true },
                    { label: "Fixed Costs", value: -dailyFixed },
                    { label: "Net Profit", value: trueNetProfit, bold: true, line: true, final: true },
                  ];
                })()} maxWidth={500} />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              <Metric label="Revenue" value={`€${todaySnap.revenue.toFixed(0)}`} unit="" />
              <Metric label="COGS" value={`€${todaySnap.cogs.toFixed(0)}`} unit="" />
              <Metric label="Gross profit" value={`€${todaySnap.grossProfit.toFixed(0)}`} unit="" />
              <Metric label="Net profit" value={`€${todaySnap.netProfit.toFixed(0)}`} unit="" alert={todaySnap.netProfit < 0} />
              <Metric label="Food cost" value={todaySnap.foodCostPct.toFixed(1)} unit="%" alert={todaySnap.foodCostPct > THRESHOLDS.MAX_FOOD_COST_PCT} />
            </div>
          )
        ) : (
          <div style={{ fontFamily: fontSans, fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 12 }}>
            No shifts logged today
            <Btn onClick={onLogShift} style={{ fontSize: 11, padding: "4px 12px" }}>+ Log a shift</Btn>
          </div>
        )}
      </div>

      {/* Period P&L Summary */}
      {periodPL.shiftCount > 0 && (
        <div style={card}>
          <div style={sectionTitle}>{`P&L Summary — Last ${periodLabel(period)}`}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: C.cream, borderRadius: 8, padding: 20, border: `1px solid ${C.border}` }}>
              <PLWaterfall rows={plRows} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignContent: "start" }}>
              <Metric label="Shifts" value={periodPL.shiftCount} unit="" size="small" />
              <Metric label="Avg daily rev." value={`€${periodPL.avgDailyRevenue.toFixed(0)}`} unit="" size="small" />
              <Metric label="Gross margin" value={periodPL.grossMarginPct.toFixed(1)} unit="%" size="small" alert={periodPL.grossMarginPct < THRESHOLDS.MIN_GROSS_MARGIN} />
              <Metric label="Net margin" value={periodPL.netMarginPct.toFixed(1)} unit="%" size="small" alert={periodPL.netMarginPct < 0} />
              <Metric label="CA annuel est." value={`€${(periodPL.annualizedRevenue / 1000).toFixed(0)}k`} unit="" size="small" />
              {hasFixedCosts && <Metric label="Daily overhead" value={`€${fixedCostData.dailyCost.toFixed(0)}`} unit="" size="small" />}
            </div>
          </div>
          {/* Break-even metrics */}
          {hasFixedCosts && breakEvenData && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 24 }}>
              <div>
                <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Daily break-even</div>
                <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 600, color: C.amber }}>{`€${breakEvenData.breakEvenRevenue.toFixed(0)}/day`}</div>
              </div>
              <div>
                <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Avg gross margin</div>
                <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 600 }}>{breakEvenData.avgGrossMarginPct.toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Daily overhead</div>
                <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 600 }}>{`€${fixedCostData.dailyCost.toFixed(0)}`}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed P&L Breakdown */}
      {plBreakdown.length > 1 && (
        <div style={card}>
          <div style={sectionTitle}>{`Detailed P&L — Last ${periodLabel(period)}`}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Period</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Revenue</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>COGS</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Gross</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Labor</th>
                  {hasFixedCosts && <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Fixed</th>}
                  <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Net</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: C.textMuted, fontWeight: 600 }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {plBreakdown.map((row, i) => {
                  const net = hasFixedCosts ? row.netProfit : row.operatingProfit;
                  return (
                    <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "8px 6px", fontWeight: 600 }}>{row.label}</td>
                      <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono }}>{`€${row.totalRevenue.toFixed(0)}`}</td>
                      <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono, color: C.red }}>{`-€${row.totalCogs.toFixed(0)}`}</td>
                      <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono }}>{`€${row.totalGross.toFixed(0)}`}</td>
                      <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono, color: C.red }}>{`-€${row.totalLabor.toFixed(0)}`}</td>
                      {hasFixedCosts && <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono, color: C.red }}>{`-€${row.fixedCostAllocation.toFixed(0)}`}</td>}
                      <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono, fontWeight: 600, color: net >= 0 ? C.green : C.red }}>
                        {net < 0 ? `-€${Math.abs(net).toFixed(0)}` : `€${net.toFixed(0)}`}
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 6px", fontFamily: fontMono, color: row.grossMarginPct < THRESHOLDS.MIN_GROSS_MARGIN ? C.red : C.text }}>
                        {row.totalRevenue > 0 ? `${row.grossMarginPct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div style={card}>
        <div style={sectionTitle}>{`Daily revenue — Last ${periodLabel(period)}`}</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyRevenue} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey={period <= 30 ? "dayName" : "date"} tick={{ fontFamily: fontMono, fontSize: period <= 30 ? 11 : 9 }} tickFormatter={period > 30 ? d => d.slice(8) : undefined} interval={period > 30 ? Math.floor(period / 15) : 0} />
            <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `€${v}`} />
            <Tooltip {...ttStyle} labelFormatter={period > 7 ? d => formatDate(d) : undefined} formatter={(v, name) => [`€${Number(v).toFixed(2)}`, name === "revenue" ? "Revenue" : name === "netProfit" ? "Net Profit" : name]} />
            {hasFixedCosts && breakEvenData && (
              <ReferenceLine y={breakEvenData.breakEvenRevenue} stroke={C.amber} strokeDasharray="5 5" label={{ value: `BE €${breakEvenData.breakEvenRevenue.toFixed(0)}`, position: "insideTopRight", fontFamily: fontMono, fontSize: 10, fill: C.amber }} />
            )}
            <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
              {dailyRevenue.map((entry, i) => {
                const dayProfit = hasFixedCosts ? entry.netProfit - fixedCostData.dailyCost : entry.netProfit;
                return (
                  <Cell key={entry.date} fill={dayProfit >= 0 ? C.green : C.red} opacity={entry.revenue === 0 ? 0.1 : 0.8} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Margin Trend */}
      {marginTrend.length > 1 && (
        <div style={card}>
          <div style={sectionTitle}>{`Gross margin trend — Last ${periodLabel(period)}`}</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={marginTrend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={d => d.slice(5)} interval={period > 30 ? Math.floor(period / 15) : undefined} />
              <YAxis domain={[0, 100]} tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip {...ttStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Margin"]} />
              <ReferenceLine y={THRESHOLDS.MIN_GROSS_MARGIN} stroke={C.amber} strokeDasharray="5 5" label={{ value: `${THRESHOLDS.MIN_GROSS_MARGIN}%`, position: "insideTopRight", fontFamily: fontMono, fontSize: 10, fill: C.amber }} />
              <Line type="monotone" dataKey="marginPct" stroke={C.green} strokeWidth={2} dot={period <= 30 ? { r: 3, fill: C.green } : false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Period Comparison */}
      <div style={card}>
        <div style={sectionTitle}>Performance by period</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {["morning", "afternoon", "full_day"].map(p => {
            const d = periodComp[p];
            return (
              <div key={p} style={{ background: C.cream, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                  {PERIOD_ICONS[p]} {PERIOD_LABELS[p]}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{d.count} shifts</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Metric label="Avg revenue" value={`€${d.avgRevenue.toFixed(0)}`} unit="" size="small" />
                  <Metric label="Avg margin" value={d.avgMargin.toFixed(1)} unit="%" size="small" alert={d.avgMargin < THRESHOLDS.MIN_GROSS_MARGIN} />
                  <Metric label="Avg net profit" value={`€${d.avgNetProfit.toFixed(0)}`} unit="" size="small" alert={d.avgNetProfit < 0} />
                  <Metric label="Rev/labor hr" value={`€${d.avgRevPerHr.toFixed(0)}`} unit="" size="small" alert={d.avgRevPerHr < THRESHOLDS.MIN_REV_PER_LABOR_HOUR} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: Top Sellers + Day of Week */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={card}>
          <div style={sectionTitle}>{`Top sellers — Last ${periodLabel(period)}`}</div>
          {topSellers.length === 0 ? (
            <div style={{ fontFamily: fontSans, fontSize: 12, color: C.textMuted }}>No sales data for this period</div>
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
                    <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 600 }}>{`€${item.totalRevenue.toFixed(0)}`}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={sectionTitle}>Avg revenue by day</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekdayData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontFamily: fontMono, fontSize: 11 }} />
              <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `€${v}`} />
              <Tooltip {...ttStyle} formatter={(v, name) => [`€${Number(v).toFixed(0)}`, name === "avgRevenue" ? "Avg Revenue" : "Avg Net Profit"]} />
              <Bar dataKey="avgRevenue" fill={C.green} radius={[4, 4, 0, 0]} opacity={0.85}>
                {weekdayData.map((entry) => (
                  <Cell key={entry.day} fill={entry.avgNetProfit >= 0 ? C.green : C.red} opacity={entry.shiftCount === 0 ? 0.15 : 0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Best / Worst Shifts */}
      {bestWorst && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {[
            { label: "Best shift", data: bestWorst.best, color: C.green, bg: C.greenPale },
            { label: "Worst shift", data: bestWorst.worst, color: C.red, bg: C.redPale },
          ].map(({ label, data, color, bg }) => (
            <div key={label} style={{ ...card, borderColor: `${color}30` }}>
              <div style={{ ...sectionTitle, color }}>{label}</div>
              <div style={{ fontFamily: font, fontSize: 16, marginBottom: 8 }}>{formatDate(data.shift.date)}</div>
              <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                {data.shift.period.replace("_", " ")} · {data.shift.staff_count} staff · {data.shift.hours_worked}h
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Metric label="Revenue" value={`€${data.metrics.revenue.toFixed(0)}`} unit="" size="small" />
                <Metric label="Net profit" value={`€${data.metrics.net_profit.toFixed(0)}`} unit="" size="small" alert={data.metrics.net_profit < 0} />
                <Metric label="Margin" value={data.metrics.gross_margin_pct.toFixed(1)} unit="%" size="small" />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
