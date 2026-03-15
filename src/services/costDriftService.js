import { calcUnitCost } from "../utils/shiftMetrics.js";

/**
 * Compute drift entries for all ingredients with >1 price_history entry.
 * Returns sorted by absolute change percentage (largest first).
 */
export function computeCostDrift(ingredients, recipes) {
  const drifts = [];
  for (const ing of ingredients) {
    const h = ing.price_history;
    if (!h || h.length < 2) continue;
    const sorted = [...h].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
    const prev = sorted[sorted.length - 2];
    const curr = sorted[sorted.length - 1];
    const changePct = prev.price_per_unit !== 0
      ? ((curr.price_per_unit - prev.price_per_unit) / prev.price_per_unit) * 100
      : 0;
    const affectedRecipes = recipes.filter(r =>
      r.items.some(item => item.ingredientId === ing.id)
    );
    drifts.push({
      ingredient: ing,
      previousPrice: prev.price_per_unit,
      currentPrice: curr.price_per_unit,
      changePct,
      effectiveDate: curr.effective_date,
      affectedRecipeCount: affectedRecipes.length,
      affectedRecipes,
    });
  }
  return drifts.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/**
 * Get summary stats for the drift dashboard.
 */
export function computeDriftSummary(ingredients, recipes, windowDays = 90) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let trackedCount = 0;
  let recentUpdates = 0;
  let totalChangePct = 0;
  let changeCount = 0;

  for (const ing of ingredients) {
    const h = ing.price_history;
    if (!h || h.length === 0) continue;
    trackedCount++;
    const sorted = [...h].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
    // Count recent updates
    for (const entry of sorted) {
      if (entry.effective_date >= cutoffStr) recentUpdates++;
    }
    // Compute change over window
    if (sorted.length >= 2) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (first.price_per_unit > 0) {
        totalChangePct += ((last.price_per_unit - first.price_per_unit) / first.price_per_unit) * 100;
        changeCount++;
      }
    }
  }

  // Count margin alerts
  let marginAlerts = 0;
  for (const recipe of recipes) {
    const uc = calcUnitCost(recipe, ingredients);
    const margin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - uc) / recipe.sellingPrice) * 100 : 0;
    if (margin < recipe.targetMargin) marginAlerts++;
  }

  return {
    trackedCount,
    recentUpdates,
    avgChangePct: changeCount > 0 ? totalChangePct / changeCount : 0,
    marginAlerts,
  };
}

/**
 * Get full price timeline for an ingredient, for charting.
 * Returns [{ date, price }] sorted chronologically.
 */
export function getIngredientTimeline(ingredient) {
  const h = ingredient.price_history;
  if (!h || h.length === 0) return [{ date: new Date().toISOString().slice(0, 10), price: ingredient.pricePerUnit }];
  return [...h]
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    .map(entry => ({ date: entry.effective_date, price: entry.price_per_unit }));
}

/**
 * Compute margin erosion analysis for a recipe.
 * Identifies which ingredients have driven the most cost increase.
 */
export function computeMarginErosion(recipe, ingredients) {
  const uc = calcUnitCost(recipe, ingredients);
  const currentMargin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - uc) / recipe.sellingPrice) * 100 : 0;

  // Find the original costs (from first price_history entry)
  let originalCost = 0;
  const costDrivers = [];
  for (const item of recipe.items) {
    const ing = ingredients.find(i => i.id === item.ingredientId);
    if (!ing) continue;
    const h = ing.price_history;
    const firstPrice = h && h.length > 0
      ? [...h].sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0].price_per_unit
      : ing.pricePerUnit;
    const currentPrice = ing.pricePerUnit;
    const firstCost = firstPrice * item.qty * (ing.wasteFactor || 1);
    const currentCostItem = currentPrice * item.qty * (ing.wasteFactor || 1);
    originalCost += firstCost;

    if (currentCostItem > firstCost) {
      costDrivers.push({
        ingredient: ing,
        costIncrease: currentCostItem - firstCost,
        pctIncrease: firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0,
      });
    }
  }
  const originalUnitCost = recipe.portions > 0 ? originalCost / recipe.portions : 0;
  const originalMargin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - originalUnitCost) / recipe.sellingPrice) * 100 : 0;

  // Compute suggested price to restore target margin
  const suggestedPrice = recipe.targetMargin < 100 ? uc / (1 - recipe.targetMargin / 100) : 0;

  return {
    recipe,
    currentMargin,
    originalMargin,
    marginDelta: currentMargin - originalMargin,
    suggestedPrice,
    costDrivers: costDrivers.sort((a, b) => b.costIncrease - a.costIncrease),
  };
}
