import { uid } from "../components/shared.jsx";

export const CURRENT_SK = "estudantina-costing-v6";
const FALLBACK_KEYS = ["estudantina-costing-v5", "estudantina-costing-v4"];

export const DEFAULT_SETTINGS = {
  priceSpikeThreshold: 5,
  marginAlertThreshold: 5,
  stalePriceDays: 90,
  autoSnapshot: true,
};

/**
 * Load data from storage with version fallback.
 * Returns { data, needsMigration } or { data: null }.
 */
export async function loadData(store) {
  try {
    let raw = await store.get(CURRENT_SK);
    if (raw) return { data: JSON.parse(raw), needsMigration: false };

    for (const key of FALLBACK_KEYS) {
      raw = await store.get(key);
      if (raw) return { data: JSON.parse(raw), needsMigration: true };
    }
  } catch (e) {
    console.warn("Failed to load data:", e);
  }
  return { data: null, needsMigration: false };
}

/**
 * Migrate older data to v6 format.
 * - Seeds price_history on each ingredient from pricePerUnit
 * - Extracts suppliers from ingredient.supplier strings
 * - Adds default settings + empty alerts
 */
export function migrateToV6(data) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowISO = new Date().toISOString();

  // 1. Seed price_history on ingredients
  const ingredients = (data.ingredients || []).map(ing => {
    if (ing.price_history && ing.price_history.length > 0) return ing;
    return {
      ...ing,
      price_history: [{
        id: uid(),
        price_per_unit: ing.pricePerUnit,
        effective_date: todayStr,
        recorded_at: nowISO,
        note: "Initial price (migrated)",
        invoice_ref: "",
      }],
    };
  });

  // 2. Extract unique suppliers
  const supplierNames = new Set();
  for (const ing of ingredients) {
    if (ing.supplier) supplierNames.add(ing.supplier);
  }

  const suppliers = [];
  const supplierMap = {};
  for (const name of supplierNames) {
    const id = `s_${uid()}`;
    const category = categorizeSupplier(name);
    suppliers.push({ id, name, category, contact: "", notes: "", ingredient_ids: [] });
    supplierMap[name] = id;
  }

  // 3. Link ingredients to suppliers
  const updatedIngredients = ingredients.map(ing => {
    const supplierId = ing.supplier ? supplierMap[ing.supplier] : null;
    const updated = { ...ing };
    if (supplierId) updated.supplier_id = supplierId;
    return updated;
  });

  // 4. Populate supplier ingredient_ids
  for (const supplier of suppliers) {
    supplier.ingredient_ids = updatedIngredients
      .filter(i => i.supplier_id === supplier.id)
      .map(i => i.id);
  }

  return {
    ingredients: updatedIngredients,
    recipes: data.recipes || [],
    shifts: data.shifts || [],
    shift_templates: data.shift_templates || [],
    suppliers,
    settings: DEFAULT_SETTINGS,
    alerts: [],
  };
}

function categorizeSupplier(name) {
  const lower = name.toLowerCase();
  if (lower === "makro" || lower === "bwt") return "Wholesale";
  if (lower === "mercado") return "Market";
  if (lower === "olisipo" || lower === "ervanária") return "Specialty";
  if (lower === "house") return "House";
  return "Other";
}
