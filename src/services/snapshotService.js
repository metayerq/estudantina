import { getIngredientPriceAt } from "./priceHistoryService.js";

/**
 * Build a snapshot for a single sale line.
 * Computes unit cost using ingredient prices at the shift date.
 */
export function buildSaleSnapshot(sale, recipe, ingredients, date) {
  let recipeCost = 0;
  for (const item of recipe.items) {
    const ing = ingredients.find(i => i.id === item.ingredientId);
    if (!ing) continue;
    const priceAtDate = getIngredientPriceAt(ing, date);
    recipeCost += priceAtDate * item.qty * (ing.wasteFactor || 1);
  }
  const cost_per_unit = recipe.portions > 0 ? recipeCost / recipe.portions : 0;
  const selling_price = recipe.sellingPrice;
  const margin_pct = selling_price > 0
    ? ((selling_price - cost_per_unit) / selling_price) * 100
    : 0;

  return {
    cost_per_unit,
    selling_price,
    margin_pct,
    snapshot_date: date,
  };
}

/**
 * Stamp all sales in a shift with snapshots.
 * Returns the shift with snapshot-enriched sales.
 */
export function stampShiftSnapshots(shift, recipes, ingredients) {
  return {
    ...shift,
    sales: shift.sales.map(sale => {
      const recipe = recipes.find(r => r.id === sale.recipe_id);
      if (!recipe) return sale;
      return {
        ...sale,
        snapshot: buildSaleSnapshot(sale, recipe, ingredients, shift.date),
      };
    }),
  };
}

/**
 * Check if a shift has snapshots on all its sales.
 */
export function shiftHasSnapshots(shift) {
  if (!shift.sales || shift.sales.length === 0) return true;
  return shift.sales.every(s => s.snapshot != null);
}
