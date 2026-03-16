import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { C, font, fontMono, fontSans, Metric, Btn } from "./shared.jsx";
import {
  getDailyRevenue, getWeekdayBreakdown, getPeriodComparison,
  getBestWorstShifts, getMarginTrend, computeDailyFixedCost, computeBreakEvenRevenue,
} from "../services/analyticsService.js";
import { THRESHOLDS } from "../utils/shiftMetrics.js";

const card = { background: C.card, borderRadius: 10, padding: 20, boxShadow: C.shadow, border: `1px solid ${C.border}`, marginBottom: 20 };
const sectionTitle = { fontFamily: fontSans, fontSize: 13, fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5, color: C.textMuted };
const ttStyle = { contentStyle: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: fontSans, fontSize: 12 } };

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", full_day: "Full Day" };
const PERIOD_ICONS = { morning: "🌅", afternoon: "☀️", full_day: "📋" };

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function ShiftAnalytics({ shifts, recipes, ingredients, fixedCosts, onBack }) {
  const dailyRevenue = useMemo(() => getDailyRevenue(shifts, recipes, ingredients, 30), [shifts, recipes, ingredients]);
  const marginTrend = useMemo(() => getMarginTrend(shifts, recipes, ingredients, 30), [shifts, recipes, ingredients]);
  const periodComp = useMemo(() => getPeriodComparison(shifts, recipes, ingredients), [shifts, recipes, ingredients]);
  const weekdayData = useMemo(() => getWeekdayBreakdown(shifts, recipes, ingredients), [shifts, recipes, ingredients]);
  const bestWorst = useMemo(() => getBestWorstShifts(shifts, recipes, ingredients), [shifts, recipes, ingredients]);

  // Fixed costs
  const fc = fixedCosts || [];
  const fixedCostData = useMemo(() => computeDailyFixedCost(fc), [fc]);
  const breakEvenData = useMemo(() => computeBreakEvenRevenue(shifts, recipes, ingredients, fc), [shifts, recipes, ingredients, fc]);
  const hasFixedCosts = fixedCostData.monthlyTotal > 0;

  // Aggregate 30-day totals for Monthly P&L
  const monthlyPL = useMemo(() => {
    if (!hasFixedCosts || dailyRevenue.length === 0) return null;
    let totalRevenue = 0, totalCogs = 0, totalGross = 0, totalLabor = 0, totalNetProfit = 0;
    for (const d of dailyRevenue) {
      totalRevenue += d.revenue;
      totalCogs += d.cogs;
      totalGross += d.grossProfit;
      totalLabor += d.laborCost;
      totalNetProfit += d.netProfit; // operating profit (rev - cogs - labor)
    }
    const monthlyFixed = fixedCostData.monthlyTotal;
    const trueNetProfit = totalNetProfit - monthlyFixed;
    return { totalRevenue, totalCogs, totalGross, totalLabor, totalNetProfit, monthlyFixed, trueNetProfit };
  }, [dailyRevenue, hasFixedCosts, fixedCostData]);

  return (
    <>
      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Btn variant="secondary" onClick={onBack} style={{ fontSize: 12 }}>← Back to shifts</Btn>
      </div>

      {/* Monthly P&L Summary — only when fixed costs are configured */}
      {monthlyPL && (
        <div style={card}>
          <div style={sectionTitle}>Monthly P&L Summary — Last 30 days</div>
          <div style={{ background: C.cream, borderRadius: 8, padding: 20, border: `1px solid ${C.border}` }}>
            {(() => {
              const rows = [
                { label: "Revenue", value: monthlyPL.totalRevenue },
                { label: "COGS", value: -monthlyPL.totalCogs },
                { label: "Gross Profit", value: monthlyPL.totalGross, line: true },
                { label: "Labor", value: -monthlyPL.totalLabor },
                { label: "Operating Profit", value: monthlyPL.totalNetProfit, line: true },
                { label: "Fixed Costs", value: -monthlyPL.monthlyFixed },
                { label: "Net Profit", value: monthlyPL.trueNetProfit, line: true, bold: true, final: true },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 400 }}>
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
            })()}
            {breakEvenData && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Daily break-even</div>
                  <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 600, color: C.amber }}>€{breakEvenData.breakEvenRevenue.toFixed(0)}/day</div>
                </div>
                <div>
                  <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Avg gross margin</div>
                  <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 600 }}>{breakEvenData.avgGrossMarginPct.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontFamily: fontSans, fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Daily overhead</div>
                  <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 600 }}>€{fixedCostData.dailyCost.toFixed(0)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revenue Trend — 30 days */}
      <div style={card}>
        <div style={sectionTitle}>Daily revenue — Last 30 days</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyRevenue} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tick={{ fontFamily: fontMono, fontSize: 9 }} tickFormatter={d => d.slice(8)} interval={2} />
            <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `€${v}`} />
            <Tooltip {...ttStyle} labelFormatter={d => formatDate(d)} formatter={(v, name) => [`€${Number(v).toFixed(2)}`, name === "revenue" ? "Revenue" : name === "netProfit" ? "Net Profit" : name]} />
            {hasFixedCosts && breakEvenData && (
              <ReferenceLine y={breakEvenData.breakEvenRevenue} stroke={C.amber} strokeDasharray="5 5" label={{ value: `BE €${breakEvenData.breakEvenRevenue.toFixed(0)}`, position: "insideTopRight", fontFamily: fontMono, fontSize: 10, fill: C.amber }} />
            )}
            <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
              {dailyRevenue.map((entry, i) => {
                const dayProfit = hasFixedCosts ? entry.netProfit - fixedCostData.dailyCost : entry.netProfit;
                return (
                  <Cell key={i} fill={dayProfit >= 0 ? C.green : C.red} opacity={entry.revenue === 0 ? 0.1 : 0.8} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Margin Trend — 30 days */}
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

      {/* Period Comparison */}
      <div style={card}>
        <div style={sectionTitle}>Performance by period</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {["morning", "afternoon", "full_day"].map(period => {
            const p = periodComp[period];
            return (
              <div key={period} style={{ background: C.cream, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                  {PERIOD_ICONS[period]} {PERIOD_LABELS[period]}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{p.count} shifts</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Metric label="Avg revenue" value={`€${p.avgRevenue.toFixed(0)}`} unit="" size="small" />
                  <Metric label="Avg margin" value={p.avgMargin.toFixed(1)} unit="%" size="small" alert={p.avgMargin < THRESHOLDS.MIN_GROSS_MARGIN} />
                  <Metric label="Avg net profit" value={`€${p.avgNetProfit.toFixed(0)}`} unit="" size="small" alert={p.avgNetProfit < 0} />
                  <Metric label="Rev/labor hr" value={`€${p.avgRevPerHr.toFixed(0)}`} unit="" size="small" alert={p.avgRevPerHr < THRESHOLDS.MIN_REV_PER_LABOR_HOUR} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day-of-Week Analysis */}
      <div style={card}>
        <div style={sectionTitle}>Average revenue by day of week</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weekdayData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="day" tick={{ fontFamily: fontMono, fontSize: 11 }} />
            <YAxis tick={{ fontFamily: fontMono, fontSize: 10 }} tickFormatter={v => `€${v}`} />
            <Tooltip {...ttStyle} formatter={(v, name) => [`€${Number(v).toFixed(0)}`, name === "avgRevenue" ? "Avg Revenue" : "Avg Net Profit"]} />
            <Bar dataKey="avgRevenue" fill={C.green} radius={[4, 4, 0, 0]} opacity={0.85}>
              {weekdayData.map((entry, i) => (
                <Cell key={i} fill={entry.avgNetProfit >= 0 ? C.green : C.red} opacity={entry.shiftCount === 0 ? 0.15 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Best / Worst Shift */}
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
