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
 * Call the Revolut Merchant API.
 * Dev: Vite proxy (/api/revolut → merchant.revolut.com/api)
 * Prod: Vercel serverless function (/api/revolut-proxy)
 */
async function callRevolut(apiKey, { endpoint, method = "GET", body } = {}) {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    const fetchOpts = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: "application/json",
        "Revolut-Api-Version": "2024-09-01",
      },
    };
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOpts.headers["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(body);
    }
    // Vite proxy rewrites /api/revolut → /api on merchant.revolut.com
    return fetch(`/api/revolut${endpoint}`, fetchOpts);
  }

  // Production: Vercel serverless proxy
  return fetch("/api/revolut-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: apiKey.trim(),
      endpoint,
      method,
      body,
    }),
  });
}

/**
 * Test Revolut Merchant API connection.
 * Creates a minimal 1-cent test order to validate the API key,
 * then immediately cancels it. We use POST because Revolut's
 * GET /api/orders endpoint has a known server-side 502 bug.
 */
export async function testRevolutConnection(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: "Please enter an API key." };
  }

  try {
    // Step 1: Create a minimal test order (1 cent) to validate the key
    const createRes = await callRevolut(apiKey, {
      endpoint: "/orders",
      method: "POST",
      body: { amount: 1, currency: "EUR" },
    });

    if (createRes.ok) {
      // Key is valid — clean up by cancelling the test order
      try {
        const order = await createRes.json();
        if (order.id) {
          await callRevolut(apiKey, {
            endpoint: `/orders/${order.id}/cancel`,
            method: "POST",
          });
        }
      } catch {
        // Cleanup failure is non-critical
      }
      return { success: true };
    }

    // Handle error responses
    const status = createRes.status;
    let detail = "";
    try {
      const errBody = await createRes.json();
      detail = errBody.message || errBody.error || "";
    } catch {}

    if (status === 401) return { success: false, error: "Invalid API key. Please check and try again." };
    if (status === 403) return { success: false, error: "Access denied. Make sure your key has merchant permissions." };
    if (status === 429) return { success: false, error: "Too many requests. Please wait a moment and try again." };

    return { success: false, error: `Connection failed (HTTP ${status}).${detail ? " " + detail : ""} Please try again.` };
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
