import { calcUnitCost } from "./shiftMetrics.js";
import { THRESHOLDS } from "./shiftMetrics.js";

export function computeMenuPerformance(recipes, ingredients, shifts) {
  // Aggregate per-recipe sales across all shifts
  const agg = {};
  for (const shift of shifts) {
    for (const sale of shift.sales) {
      if (!agg[sale.recipe_id]) agg[sale.recipe_id] = { totalQty: 0, totalRevenue: 0 };
      const recipe = recipes.find(r => r.id === sale.recipe_id);
      if (!recipe) continue;
      agg[sale.recipe_id].totalQty += sale.quantity;
      // Prefer snapshot selling_price for historical accuracy
      const price = sale.snapshot ? sale.snapshot.selling_price : recipe.sellingPrice;
      agg[sale.recipe_id].totalRevenue += sale.quantity * price;
    }
  }

  // Build performance entries for recipes that have sales
  const entries = [];
  for (const recipe of recipes) {
    const data = agg[recipe.id];
    if (!data || data.totalQty === 0) continue;
    const unitCost = calcUnitCost(recipe, ingredients);
    const avgMargin = recipe.sellingPrice > 0
      ? ((recipe.sellingPrice - unitCost) / recipe.sellingPrice) * 100
      : 0;
    entries.push({ recipe, totalQty: data.totalQty, totalRevenue: data.totalRevenue, avgMargin, unitCost, quadrant: null });
  }

  if (entries.length === 0) return [];

  // Compute median qty
  const sorted = [...entries].sort((a, b) => a.totalQty - b.totalQty);
  const mid = Math.floor(sorted.length / 2);
  const medianQty = sorted.length % 2 === 0
    ? (sorted[mid - 1].totalQty + sorted[mid].totalQty) / 2
    : sorted[mid].totalQty;

  // Classify quadrants
  const marginThreshold = THRESHOLDS.MIN_GROSS_MARGIN;
  for (const e of entries) {
    const highMargin = e.avgMargin >= marginThreshold;
    const highVolume = e.totalQty >= medianQty;
    if (highMargin && highVolume) e.quadrant = "star";
    else if (highMargin && !highVolume) e.quadrant = "hidden_gem";
    else if (!highMargin && highVolume) e.quadrant = "question";
    else e.quadrant = "dog";
  }

  return entries.sort((a, b) => b.totalQty - a.totalQty);
}

const QUADRANT_STYLES = {
  star: { label: "Star", color: "#2D5A3D", bg: "#E8F0EA" },
  hidden_gem: { label: "Hidden Gem", color: "#2563EB", bg: "#EFF6FF" },
  question: { label: "Question", color: "#B8860B", bg: "#FFF8E7" },
  dog: { label: "Dog", color: "#C44D4D", bg: "#FDF0F0" },
};

export function getQuadrantStyle(quadrant) {
  return QUADRANT_STYLES[quadrant] || QUADRANT_STYLES.dog;
}

export function getActionRecommendations(performanceData) {
  const grouped = {};
  for (const d of performanceData) {
    if (!grouped[d.quadrant]) grouped[d.quadrant] = [];
    grouped[d.quadrant].push(d.recipe.name);
  }

  const messages = {
    star: names => `Keep doing what you're doing with ${names.join(", ")} — high margin and high demand.`,
    hidden_gem: names => `Consider promoting ${names.join(", ")} — great margins but low volume. Marketing could unlock growth.`,
    question: names => `Review pricing for ${names.join(", ")} — popular but thin margins are eating into profit.`,
    dog: names => `Consider removing or repricing ${names.join(", ")} — low margin and low demand.`,
  };

  const order = ["star", "hidden_gem", "question", "dog"];
  const results = [];
  for (const q of order) {
    if (!grouped[q]) continue;
    const qs = getQuadrantStyle(q);
    results.push({ quadrant: q, label: qs.label, recipeNames: grouped[q], message: messages[q](grouped[q]) });
  }
  return results;
}

export function computeBreakEven(shiftData, recipes, ingredients) {
  // Import computeShiftMetrics inline to avoid circular — recalculate manually
  let revenue = 0, totalCOGS = 0;
  for (const sale of (shiftData.sales || [])) {
    const recipe = recipes.find(r => r.id === sale.recipe_id);
    if (!recipe) continue;
    const unitCost = calcUnitCost(recipe, ingredients);
    revenue += recipe.sellingPrice * sale.quantity;
    totalCOGS += unitCost * sale.quantity;
  }
  const grossProfit = revenue - totalCOGS;
  const laborCost = (shiftData.staff_count || 0) * (shiftData.hours_worked || 0) * (shiftData.hourly_rate || 0);
  const netProfit = grossProfit - laborCost;

  if (netProfit >= 0) {
    return { isAlreadyProfitable: true, recipe: null, additionalUnits: 0, currentNetProfit: netProfit };
  }

  // Find top-selling recipe, or highest-margin recipe if no sales
  let targetRecipe = null;
  if (shiftData.sales && shiftData.sales.length > 0) {
    const topSale = [...shiftData.sales].sort((a, b) => b.quantity - a.quantity)[0];
    targetRecipe = recipes.find(r => r.id === topSale.recipe_id);
  }
  if (!targetRecipe) {
    // Pick the highest-margin recipe
    let bestMargin = -Infinity;
    for (const r of recipes) {
      const uc = calcUnitCost(r, ingredients);
      const margin = r.sellingPrice - uc;
      if (margin > bestMargin) { bestMargin = margin; targetRecipe = r; }
    }
  }

  if (!targetRecipe) {
    return { isAlreadyProfitable: false, recipe: null, additionalUnits: 0, currentNetProfit: netProfit };
  }

  const uc = calcUnitCost(targetRecipe, ingredients);
  const marginalProfit = targetRecipe.sellingPrice - uc;
  if (marginalProfit <= 0) {
    return { isAlreadyProfitable: false, recipe: targetRecipe, additionalUnits: Infinity, currentNetProfit: netProfit };
  }

  const additionalUnits = Math.ceil(Math.abs(netProfit) / marginalProfit);
  return { isAlreadyProfitable: false, recipe: targetRecipe, additionalUnits, currentNetProfit: netProfit };
}
