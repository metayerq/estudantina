import { computeShiftMetrics } from "../utils/shiftMetrics.js";
import { calcUnitCost, getMargin } from "../utils/shiftMetrics.js";
import { getActiveAlertCount } from "./alertService.js";

// ─── Helpers ──────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateStr(d) { return d.toISOString().slice(0, 10); }

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_NAMES[d.getDay()];
}

/**
 * Filter shifts to those within the last N days.
 */
export function filterShiftsByDays(shifts, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = toDateStr(cutoff);
  return shifts.filter(s => s.date >= cutoffStr);
}

/**
 * Filter shifts within a date range [from, to] inclusive.
 */
export function filterShiftsByRange(shifts, fromDate, toDate) {
  return shifts.filter(s => s.date >= fromDate && s.date <= toDate);
}

// ─── Daily Revenue (last N days, zero-fills missing days) ────

/**
 * Returns [{ date, dayName, revenue, cogs, grossProfit, netProfit, laborCost, shiftCount }]
 * sorted by date ascending. Days with no shifts get zeros.
 */
export function getDailyRevenue(shifts, recipes, ingredients, days = 30) {
  // Build map date → aggregated metrics
  const map = {};
  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    if (!map[shift.date]) {
      map[shift.date] = { revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0, laborCost: 0, shiftCount: 0 };
    }
    const d = map[shift.date];
    d.revenue += m.revenue;
    d.cogs += m.totalCOGS;
    d.grossProfit += m.gross_profit;
    d.netProfit += m.net_profit;
    d.laborCost += m.labor_cost;
    d.shiftCount += 1;
  }

  // Fill missing days
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const entry = map[ds] || { revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0, laborCost: 0, shiftCount: 0 };
    result.push({
      date: ds,
      dayName: dayLabel(ds),
      ...entry,
    });
  }
  return result;
}

// ─── Weekday Breakdown ───────────────────────────────────────

/**
 * Returns 7 entries (Mon–Sun): { day, dayIndex, avgRevenue, avgNetProfit, totalRevenue, shiftCount }
 */
export function getWeekdayBreakdown(shifts, recipes, ingredients) {
  // Group by day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const buckets = Array.from({ length: 7 }, () => ({ totalRevenue: 0, totalNetProfit: 0, count: 0 }));

  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    const dow = new Date(shift.date + "T12:00:00").getDay();
    buckets[dow].totalRevenue += m.revenue;
    buckets[dow].totalNetProfit += m.net_profit;
    buckets[dow].count += 1;
  }

  // Return Mon–Sun order (indices 1,2,3,4,5,6,0)
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((idx, i) => ({
    day: DAY_NAMES[idx],
    dayIndex: idx,
    avgRevenue: buckets[idx].count > 0 ? buckets[idx].totalRevenue / buckets[idx].count : 0,
    avgNetProfit: buckets[idx].count > 0 ? buckets[idx].totalNetProfit / buckets[idx].count : 0,
    totalRevenue: buckets[idx].totalRevenue,
    shiftCount: buckets[idx].count,
  }));
}

// ─── Period Comparison ───────────────────────────────────────

/**
 * Returns { morning: {...}, afternoon: {...}, full_day: {...} }
 * Each: { avgRevenue, avgMargin, avgNetProfit, avgRevPerHr, count }
 */
export function getPeriodComparison(shifts, recipes, ingredients) {
  const buckets = {
    morning: { totalRev: 0, totalMargin: 0, totalNet: 0, totalRevPerHr: 0, count: 0 },
    afternoon: { totalRev: 0, totalMargin: 0, totalNet: 0, totalRevPerHr: 0, count: 0 },
    full_day: { totalRev: 0, totalMargin: 0, totalNet: 0, totalRevPerHr: 0, count: 0 },
  };

  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    const b = buckets[shift.period];
    if (!b) continue;
    b.totalRev += m.revenue;
    b.totalMargin += m.gross_margin_pct;
    b.totalNet += m.net_profit;
    b.totalRevPerHr += m.revenue_per_labor_hour;
    b.count += 1;
  }

  const result = {};
  for (const [period, b] of Object.entries(buckets)) {
    result[period] = {
      avgRevenue: b.count > 0 ? b.totalRev / b.count : 0,
      avgMargin: b.count > 0 ? b.totalMargin / b.count : 0,
      avgNetProfit: b.count > 0 ? b.totalNet / b.count : 0,
      avgRevPerHr: b.count > 0 ? b.totalRevPerHr / b.count : 0,
      count: b.count,
    };
  }
  return result;
}

// ─── Top Sellers ─────────────────────────────────────────────

/**
 * Returns [{ recipeId, name, category, totalQty, totalRevenue, avgMargin }]
 * sorted by totalRevenue descending, limited to `limit` entries.
 */
export function getTopSellers(shifts, recipes, ingredients, limit = 5) {
  const agg = {};
  for (const shift of shifts) {
    for (const sale of shift.sales) {
      const recipe = recipes.find(r => r.id === sale.recipe_id);
      if (!recipe) continue;
      if (!agg[sale.recipe_id]) {
        const uc = sale.snapshot ? sale.snapshot.cost_per_unit : calcUnitCost(recipe, ingredients);
        const sp = sale.snapshot ? sale.snapshot.selling_price : recipe.sellingPrice;
        agg[sale.recipe_id] = {
          recipeId: recipe.id,
          name: recipe.name,
          category: recipe.category,
          totalQty: 0,
          totalRevenue: 0,
          totalMarginWeighted: 0,
        };
      }
      const sp = sale.snapshot ? sale.snapshot.selling_price : recipe.sellingPrice;
      const uc = sale.snapshot ? sale.snapshot.cost_per_unit : calcUnitCost(recipe, ingredients);
      const margin = getMargin(sp, uc);
      agg[sale.recipe_id].totalQty += sale.quantity;
      agg[sale.recipe_id].totalRevenue += sale.quantity * sp;
      agg[sale.recipe_id].totalMarginWeighted += sale.quantity * margin;
    }
  }

  return Object.values(agg)
    .map(a => ({
      ...a,
      avgMargin: a.totalQty > 0 ? a.totalMarginWeighted / a.totalQty : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

// ─── Food Cost % ─────────────────────────────────────────────

/**
 * THE restaurant KPI: total COGS / total Revenue × 100.
 */
export function getFoodCostPct(shifts, recipes, ingredients) {
  let totalRev = 0;
  let totalCOGS = 0;
  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    totalRev += m.revenue;
    totalCOGS += m.totalCOGS;
  }
  return totalRev > 0 ? (totalCOGS / totalRev) * 100 : 0;
}

// ─── Best / Worst Shifts ─────────────────────────────────────

/**
 * Returns { best: { shift, metrics }, worst: { shift, metrics } } by net profit.
 * Returns null if no shifts.
 */
export function getBestWorstShifts(shifts, recipes, ingredients) {
  if (shifts.length === 0) return null;

  let best = null;
  let worst = null;

  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    if (m.revenue === 0) continue;
    if (!best || m.net_profit > best.metrics.net_profit) best = { shift, metrics: m };
    if (!worst || m.net_profit < worst.metrics.net_profit) worst = { shift, metrics: m };
  }
  return best ? { best, worst } : null;
}

// ─── Margin Trend ────────────────────────────────────────────

/**
 * Daily weighted-average gross margin for the last N days.
 * Returns [{ date, marginPct }]. Days without shifts are excluded.
 */
export function getMarginTrend(shifts, recipes, ingredients, days = 30) {
  const map = {};
  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    if (m.revenue === 0) continue;
    if (!map[shift.date]) {
      map[shift.date] = { totalRev: 0, totalGP: 0 };
    }
    map[shift.date].totalRev += m.revenue;
    map[shift.date].totalGP += m.gross_profit;
  }

  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    if (map[ds]) {
      result.push({
        date: ds,
        marginPct: map[ds].totalRev > 0 ? (map[ds].totalGP / map[ds].totalRev) * 100 : 0,
      });
    }
  }
  return result;
}

// ─── Today's Snapshot ────────────────────────────────────────

/**
 * Aggregate metrics for today's shifts. Returns null if no shifts today.
 */
export function getTodaySnapshot(shifts, recipes, ingredients) {
  const today = toDateStr(new Date());
  const todayShifts = shifts.filter(s => s.date === today);
  if (todayShifts.length === 0) return null;

  let revenue = 0, cogs = 0, grossProfit = 0, netProfit = 0, laborCost = 0;
  for (const shift of todayShifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    revenue += m.revenue;
    cogs += m.totalCOGS;
    grossProfit += m.gross_profit;
    netProfit += m.net_profit;
    laborCost += m.labor_cost;
  }

  return {
    revenue,
    cogs,
    grossProfit,
    netProfit,
    laborCost,
    foodCostPct: revenue > 0 ? (cogs / revenue) * 100 : 0,
    shiftCount: todayShifts.length,
  };
}

// ─── Quick Stats ─────────────────────────────────────────────

/**
 * Summary stats for the dashboard header.
 */
export function getQuickStats(recipes, ingredients, alerts) {
  let totalMargin = 0;
  let counted = 0;
  for (const r of recipes) {
    const uc = calcUnitCost(r, ingredients);
    const m = getMargin(r.sellingPrice, uc);
    if (r.sellingPrice > 0) { totalMargin += m; counted++; }
  }
  return {
    totalRecipes: recipes.length,
    avgMargin: counted > 0 ? totalMargin / counted : 0,
    activeAlerts: getActiveAlertCount(alerts),
  };
}

// ─── Fixed Cost Allocation ──────────────────────────────────

/**
 * Compute monthly total and daily allocation from fixed costs.
 * Converts quarterly (÷3) and annual (÷12) to monthly equivalent, divides by 30.
 */
export function computeDailyFixedCost(fixedCosts) {
  let monthlyTotal = 0;
  for (const fc of fixedCosts) {
    if (!fc.active) continue;
    if (fc.frequency === "monthly") monthlyTotal += fc.amount;
    else if (fc.frequency === "quarterly") monthlyTotal += fc.amount / 3;
    else if (fc.frequency === "annual") monthlyTotal += fc.amount / 12;
  }
  return { monthlyTotal, dailyCost: monthlyTotal / 30 };
}

/**
 * Compute daily break-even revenue needed to cover labor + fixed costs.
 * Uses average gross margin from all shifts.
 * Returns { breakEvenRevenue, avgGrossMarginPct, dailyFixedCost, avgDailyLabor } or null if no data.
 */
export function computeBreakEvenRevenue(shifts, recipes, ingredients, fixedCosts) {
  if (shifts.length === 0) return null;

  let totalRev = 0, totalGP = 0, totalLabor = 0, dayCount = 0;
  const days = new Set();
  for (const shift of shifts) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    totalRev += m.revenue;
    totalGP += m.gross_profit;
    totalLabor += m.labor_cost;
    days.add(shift.date);
  }
  dayCount = days.size || 1;

  if (totalRev === 0) return null;

  const avgGrossMarginPct = (totalGP / totalRev) * 100;
  const avgDailyLabor = totalLabor / dayCount;
  const { dailyCost } = computeDailyFixedCost(fixedCosts);

  // Break-even: revenue where gross_profit covers labor + fixed costs
  // revenue × (marginPct/100) = avgDailyLabor + dailyCost
  const breakEvenRevenue = avgGrossMarginPct > 0
    ? (avgDailyLabor + dailyCost) / (avgGrossMarginPct / 100)
    : 0;

  return { breakEvenRevenue, avgGrossMarginPct, dailyFixedCost: dailyCost, avgDailyLabor };
}

// ─── Period P&L Summary ──────────────────────────────────────

/**
 * Full P&L aggregation for the last N days.
 * Returns { totalRevenue, totalCogs, totalGross, totalLabor, operatingProfit,
 *           fixedCostAllocation, netProfit, dayCount, shiftCount,
 *           annualizedRevenue, avgDailyRevenue, grossMarginPct, netMarginPct }
 */
export function getPeriodPL(shifts, recipes, ingredients, fixedCosts, days) {
  const filtered = filterShiftsByDays(shifts, days);
  let totalRevenue = 0, totalCogs = 0, totalGross = 0, totalLabor = 0;
  for (const shift of filtered) {
    const m = computeShiftMetrics(shift, recipes, ingredients);
    totalRevenue += m.revenue;
    totalCogs += m.totalCOGS;
    totalGross += m.gross_profit;
    totalLabor += m.labor_cost;
  }
  const operatingProfit = totalGross - totalLabor;
  const { dailyCost } = computeDailyFixedCost(fixedCosts || []);
  const fixedCostAllocation = dailyCost * days;
  const netProfit = operatingProfit - fixedCostAllocation;
  const grossMarginPct = totalRevenue > 0 ? (totalGross / totalRevenue) * 100 : 0;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const avgDailyRevenue = totalRevenue / days;
  const annualizedRevenue = avgDailyRevenue * 365;

  return {
    totalRevenue, totalCogs, totalGross, totalLabor, operatingProfit,
    fixedCostAllocation, netProfit, dayCount: days, shiftCount: filtered.length,
    annualizedRevenue, avgDailyRevenue, grossMarginPct, netMarginPct,
  };
}

// ─── Detailed P&L Breakdown ─────────────────────────────────

/**
 * Break a period into sub-buckets with P&L for each.
 * 7d → daily, 30d → weekly, 90d/180d/365d → monthly.
 * Returns [{ label, ...plData }]
 */
export function getDetailedPLBreakdown(shifts, recipes, ingredients, fixedCosts, days) {
  const today = new Date();
  const buckets = [];

  if (days <= 7) {
    // Daily buckets
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
      const dayShifts = shifts.filter(s => s.date === ds);
      buckets.push({ label, shifts: dayShifts, bucketDays: 1 });
    }
  } else if (days <= 30) {
    // Weekly buckets
    const numWeeks = Math.ceil(days / 7);
    for (let w = numWeeks - 1; w >= 0; w--) {
      const endD = new Date(today);
      endD.setDate(endD.getDate() - w * 7);
      const startD = new Date(endD);
      startD.setDate(startD.getDate() - 6);
      // Clamp start to the period boundary
      const periodStart = new Date(today);
      periodStart.setDate(periodStart.getDate() - days);
      const clampedStart = startD < periodStart ? periodStart : startD;
      const fromStr = toDateStr(clampedStart);
      const toStr = toDateStr(endD);
      const bucketShifts = filterShiftsByRange(shifts, fromStr, toStr);
      const bucketDays = Math.round((endD - clampedStart) / (1000 * 60 * 60 * 24)) + 1;
      const label = `${clampedStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${endD.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      buckets.push({ label, shifts: bucketShifts, bucketDays });
    }
  } else {
    // Monthly buckets
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
    // Walk month by month
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= today) {
      const monthStart = new Date(Math.max(cursor.getTime(), startDate.getTime()));
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); // last day of month
      const clampedEnd = monthEnd > today ? today : monthEnd;
      const fromStr = toDateStr(monthStart);
      const toStr = toDateStr(clampedEnd);
      const bucketShifts = filterShiftsByRange(shifts, fromStr, toStr);
      const bucketDays = Math.round((clampedEnd - monthStart) / (1000 * 60 * 60 * 24)) + 1;
      const label = monthStart.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      buckets.push({ label, shifts: bucketShifts, bucketDays });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  // Compute P&L for each bucket
  const { dailyCost } = computeDailyFixedCost(fixedCosts || []);
  return buckets.map(b => {
    let totalRevenue = 0, totalCogs = 0, totalGross = 0, totalLabor = 0;
    for (const shift of b.shifts) {
      const m = computeShiftMetrics(shift, recipes, ingredients);
      totalRevenue += m.revenue;
      totalCogs += m.totalCOGS;
      totalGross += m.gross_profit;
      totalLabor += m.labor_cost;
    }
    const operatingProfit = totalGross - totalLabor;
    const fixedCostAllocation = dailyCost * b.bucketDays;
    const netProfit = operatingProfit - fixedCostAllocation;
    const grossMarginPct = totalRevenue > 0 ? (totalGross / totalRevenue) * 100 : 0;
    return {
      label: b.label,
      totalRevenue, totalCogs, totalGross, totalLabor,
      operatingProfit, fixedCostAllocation, netProfit,
      shiftCount: b.shifts.length, bucketDays: b.bucketDays, grossMarginPct,
    };
  });
}
