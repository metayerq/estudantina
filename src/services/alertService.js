import { calcUnitCost } from "../utils/shiftMetrics.js";

/**
 * Generate alerts based on current state.
 * Called after price updates or on settings change.
 */
export function generateAlerts(ingredients, recipes, settings) {
  const alerts = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  for (const ing of ingredients) {
    const h = ing.price_history;
    if (!h || h.length === 0) continue;

    const sorted = [...h].sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    // Price spike check: compare last two entries
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2];
      const curr = sorted[sorted.length - 1];
      const changePct = prev.price_per_unit !== 0
        ? ((curr.price_per_unit - prev.price_per_unit) / prev.price_per_unit) * 100
        : 0;
      if (changePct > settings.priceSpikeThreshold) {
        const affectedRecipeIds = recipes
          .filter(r => r.items.some(item => item.ingredientId === ing.id))
          .map(r => r.id);
        alerts.push({
          id: `spike_${ing.id}_${curr.id}`,
          type: "price_spike",
          severity: changePct > settings.priceSpikeThreshold * 2 ? "critical" : "warning",
          ingredient_id: ing.id,
          recipe_ids: affectedRecipeIds,
          message: `${ing.name} price increased ${changePct.toFixed(1)}% (€${prev.price_per_unit.toFixed(2)} → €${curr.price_per_unit.toFixed(2)})`,
          created_at: now.toISOString(),
          dismissed: false,
        });
      }
    }

    // Stale price check
    const latest = sorted[sorted.length - 1];
    const daysSince = Math.floor((now - new Date(latest.effective_date)) / (1000 * 60 * 60 * 24));
    if (daysSince > settings.stalePriceDays) {
      alerts.push({
        id: `stale_${ing.id}`,
        type: "stale_price",
        severity: "warning",
        ingredient_id: ing.id,
        recipe_ids: [],
        message: `${ing.name} price hasn't been updated in ${daysSince} days`,
        created_at: now.toISOString(),
        dismissed: false,
      });
    }
  }

  // Margin drop check
  for (const recipe of recipes) {
    const uc = calcUnitCost(recipe, ingredients);
    const margin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - uc) / recipe.sellingPrice) * 100 : 0;
    if (recipe.sellingPrice > 0 && margin < recipe.targetMargin - settings.marginAlertThreshold) {
      alerts.push({
        id: `margin_${recipe.id}`,
        type: "margin_drop",
        severity: margin < recipe.targetMargin - settings.marginAlertThreshold * 2 ? "critical" : "warning",
        ingredient_id: null,
        recipe_ids: [recipe.id],
        message: `${recipe.name} margin (${margin.toFixed(1)}%) is ${(recipe.targetMargin - margin).toFixed(1)}% below target`,
        created_at: now.toISOString(),
        dismissed: false,
      });
    }
  }

  return alerts;
}

/**
 * Merge new alerts with existing ones, preserving dismissed state.
 */
export function mergeAlerts(existingAlerts, newAlerts) {
  const dismissedIds = new Set(existingAlerts.filter(a => a.dismissed).map(a => a.id));
  return newAlerts.map(a => ({
    ...a,
    dismissed: dismissedIds.has(a.id) ? true : a.dismissed,
  }));
}

/**
 * Dismiss an alert by ID.
 */
export function dismissAlert(alerts, alertId) {
  return alerts.map(a => a.id === alertId ? { ...a, dismissed: true } : a);
}

/**
 * Get count of active (non-dismissed) alerts.
 */
export function getActiveAlertCount(alerts) {
  return alerts.filter(a => !a.dismissed).length;
}
