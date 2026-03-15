export const SUPPLIER_CATEGORIES = ["Wholesale", "Market", "Specialty", "House", "Other"];

export function createSupplier(suppliers, newSupplier) {
  return [...suppliers, newSupplier];
}

export function updateSupplier(suppliers, id, updates) {
  return suppliers.map(s => s.id === id ? { ...s, ...updates } : s);
}

export function deleteSupplier(suppliers, id) {
  return suppliers.filter(s => s.id !== id);
}

export function getSupplierById(suppliers, id) {
  return suppliers.find(s => s.id === id) || null;
}

/**
 * Get all ingredients linked to a supplier.
 */
export function getSupplierIngredients(supplier, ingredients) {
  return ingredients.filter(i => supplier.ingredient_ids.includes(i.id));
}

/**
 * Get the most recent price update date across all of a supplier's ingredients.
 */
export function getSupplierLastUpdate(supplier, ingredients) {
  let latest = null;
  for (const ing of ingredients) {
    if (!supplier.ingredient_ids.includes(ing.id)) continue;
    const h = ing.price_history;
    if (!h || h.length === 0) continue;
    for (const entry of h) {
      if (!latest || entry.effective_date > latest) latest = entry.effective_date;
    }
  }
  return latest;
}
