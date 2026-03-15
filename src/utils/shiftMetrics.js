export const calcRecipeCost = (recipe, ingredients) => {
  let total = 0;
  for (const item of recipe.items) {
    const ing = ingredients.find(i => i.id === item.ingredientId);
    if (ing) total += ing.pricePerUnit * item.qty * (ing.wasteFactor || 1);
  }
  return total;
};

export const calcUnitCost = (recipe, ingredients) => {
  const t = calcRecipeCost(recipe, ingredients);
  return recipe.portions > 0 ? t / recipe.portions : 0;
};

export const getMargin = (sp, uc) => sp > 0 ? ((sp - uc) / sp) * 100 : 0;

export const THRESHOLDS = {
  MIN_GROSS_MARGIN: 72,
  MIN_REV_PER_LABOR_HOUR: 35,
};

export function computeShiftMetrics(shift, recipes, ingredients) {
  let revenue = 0;
  let totalCOGS = 0;
  let hasEstimatedCosts = false;

  for (const sale of shift.sales) {
    const recipe = recipes.find(r => r.id === sale.recipe_id);
    if (!recipe) continue;

    if (sale.snapshot) {
      // Use frozen snapshot values — historical accuracy
      revenue += sale.snapshot.selling_price * sale.quantity;
      totalCOGS += sale.snapshot.cost_per_unit * sale.quantity;
    } else {
      // Fallback: legacy shift without snapshot
      const unitCost = calcUnitCost(recipe, ingredients);
      revenue += recipe.sellingPrice * sale.quantity;
      totalCOGS += unitCost * sale.quantity;
      hasEstimatedCosts = true;
    }
  }

  const gross_profit = revenue - totalCOGS;
  const gross_margin_pct = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
  const labor_cost = shift.staff_count * shift.hours_worked * shift.hourly_rate;
  const net_profit = gross_profit - labor_cost;
  const total_labor_hours = shift.staff_count * shift.hours_worked;
  const revenue_per_labor_hour = total_labor_hours > 0 ? revenue / total_labor_hours : 0;
  const is_profitable = net_profit > 0;

  return { revenue, totalCOGS, gross_profit, gross_margin_pct, labor_cost, net_profit, revenue_per_labor_hour, total_labor_hours, is_profitable, hasEstimatedCosts };
}

export function getShiftAlertLevel(metrics) {
  if (!metrics.is_profitable) return "red";
  if (metrics.gross_margin_pct < THRESHOLDS.MIN_GROSS_MARGIN) return "amber";
  if (metrics.revenue_per_labor_hour < THRESHOLDS.MIN_REV_PER_LABOR_HOUR) return "amber";
  return "green";
}
