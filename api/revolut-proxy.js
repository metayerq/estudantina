// Vercel serverless function — proxies Revolut Merchant API calls
// Avoids CORS issues since browser can't call merchant.revolut.com directly

export default async function handler(req, res) {
  // Only allow POST (our proxy protocol — the actual Revolut method is in the body)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, endpoint, method = "GET", body } = req.body || {};

  if (!apiKey || !endpoint) {
    return res.status(400).json({ error: "Missing apiKey or endpoint" });
  }

  const isSandbox = apiKey.startsWith("sk_test_") || apiKey.startsWith("sandbox_");
  const baseUrl = isSandbox
    ? "https://sandbox-merchant.revolut.com"
    : "https://merchant.revolut.com";

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Revolut-Api-Version": "2024-09-01",
  };

  // Only add Content-Type for methods that send a body
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const fetchOpts = { method, headers };
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOpts.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, fetchOpts);
    const data = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(data);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach Revolut API", detail: err.message });
  }
}
