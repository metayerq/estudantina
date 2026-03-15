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
