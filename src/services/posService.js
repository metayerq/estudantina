import store from "./storage.js";

const POS_CONFIG_KEY = "cafepilot-pos";

export const POS_PROVIDERS = [
  { id: "revolut", name: "Revolut", color: "#0666EB", icon: "🏦", available: true },
  { id: "square", name: "Square", color: "#006AFF", icon: "⬛", available: false },
  { id: "vendus", name: "Vendus", color: "#FF6B00", icon: "🟠", available: false },
  { id: "sumup", name: "SumUp", color: "#1A3C6E", icon: "📱", available: false },
  { id: "stripe", name: "Stripe", color: "#635BFF", icon: "💳", available: false },
  { id: "viva", name: "Viva", color: "#00B4D8", icon: "🌊", available: false },
];

export const DEFAULT_POS_CONFIG = {
  provider: null,
  apiKey: "",
  connected: false,
  connectedAt: null,
};

/**
 * Test Revolut Merchant API connection.
 * Uses Vite proxy in dev (/api/revolut → merchant.revolut.com/api/1.0)
 * and Vercel serverless function in production (/api/revolut-proxy).
 */
export async function testRevolutConnection(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: "Please enter an API key." };
  }

  try {
    // In production (Vercel), use the serverless proxy
    // In dev, use the Vite proxy which forwards to Revolut directly
    const isDev = import.meta.env.DEV;
    let response;

    if (isDev) {
      response = await fetch("/api/revolut/orders?limit=1", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
          "Revolut-Api-Version": "2024-09-01",
        },
      });
    } else {
      // Production: call Vercel serverless proxy
      response = await fetch("/api/revolut-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          endpoint: "/orders?limit=1",
        }),
      });
    }

    if (response.ok) {
      return { success: true };
    }

    const status = response.status;
    if (status === 401) return { success: false, error: "Invalid API key. Please check and try again." };
    if (status === 403) return { success: false, error: "Access denied. Make sure your key has merchant permissions." };
    if (status === 429) return { success: false, error: "Too many requests. Please wait a moment and try again." };

    return { success: false, error: `Connection failed (HTTP ${status}). Please try again.` };
  } catch (err) {
    return { success: false, error: "Could not reach Revolut. Check your internet connection." };
  }
}

export async function savePosConfig(config) {
  await store.set(POS_CONFIG_KEY, JSON.stringify(config));
}

export async function getPosConfig() {
  try {
    const raw = await store.get(POS_CONFIG_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_POS_CONFIG };
  } catch {
    return { ...DEFAULT_POS_CONFIG };
  }
}

export async function clearPosConfig() {
  await store.set(POS_CONFIG_KEY, JSON.stringify(DEFAULT_POS_CONFIG));
}
