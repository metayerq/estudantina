import { uid } from "../components/shared.jsx";

/**
 * Get the price of an ingredient at a specific date.
 * Walks price_history descending by effective_date until effective_date <= date.
 * Falls back to ingredient.pricePerUnit if no history.
 */
export function getIngredientPriceAt(ingredient, date) {
  const history = ingredient.price_history;
  if (!history || history.length === 0) return ingredient.pricePerUnit;

  const sorted = [...history].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  for (const entry of sorted) {
    if (entry.effective_date <= date) return entry.price_per_unit;
  }
  // All entries are in the future — return earliest known price
  return sorted[sorted.length - 1].price_per_unit;
}

/**
 * Get current price = latest entry in price_history, or pricePerUnit fallback.
 */
export function getCurrentPrice(ingredient) {
  const history = ingredient.price_history;
  if (!history || history.length === 0) return ingredient.pricePerUnit;
  const sorted = [...history].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  return sorted[0].price_per_unit;
}

/**
 * Append a new price entry to an ingredient's price_history.
 * Also updates pricePerUnit to the new price if effective_date <= today.
 * Returns the updated ingredient (immutable).
 */
export function addPriceEntry(ingredient, { price_per_unit, effective_date, note, invoice_ref }) {
  const entry = {
    id: uid(),
    price_per_unit,
    effective_date,
    recorded_at: new Date().toISOString(),
    note: note || "",
    invoice_ref: invoice_ref || "",
  };
  const newHistory = [...(ingredient.price_history || []), entry];
  const today = new Date().toISOString().slice(0, 10);
  const shouldUpdateCurrent = effective_date <= today;
  return {
    ...ingredient,
    price_history: newHistory,
    pricePerUnit: shouldUpdateCurrent ? price_per_unit : ingredient.pricePerUnit,
  };
}

/**
 * Calculate recipe cost at a specific date using historical prices.
 */
export function calcRecipeCostAtDate(recipe, ingredients, date) {
  let total = 0;
  for (const item of recipe.items) {
    const ing = ingredients.find(i => i.id === item.ingredientId);
    if (!ing) continue;
    const price = getIngredientPriceAt(ing, date);
    total += price * item.qty * (ing.wasteFactor || 1);
  }
  return total;
}

/**
 * Calculate unit cost at a specific date.
 */
export function calcUnitCostAtDate(recipe, ingredients, date) {
  const total = calcRecipeCostAtDate(recipe, ingredients, date);
  return recipe.portions > 0 ? total / recipe.portions : 0;
}

/**
 * Calculate the % change between two dates for a single ingredient.
 */
export function computePriceChangePct(ingredient, fromDate, toDate) {
  const priceBefore = getIngredientPriceAt(ingredient, fromDate);
  const priceAfter = getIngredientPriceAt(ingredient, toDate);
  if (priceBefore === 0) return 0;
  return ((priceAfter - priceBefore) / priceBefore) * 100;
}
