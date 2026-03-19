// Vercel serverless function — proxies Revolut Merchant API calls
// Avoids CORS issues since browser can't call merchant.revolut.com directly

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, endpoint } = req.body || {};

  if (!apiKey || !endpoint) {
    return res.status(400).json({ error: "Missing apiKey or endpoint" });
  }

  // Determine base URL from key type
  // Merchant API v1.0: /api/1.0/orders
  const isSandbox = apiKey.startsWith("sk_test_") || apiKey.startsWith("sandbox_");
  const baseUrl = isSandbox
    ? "https://sandbox-merchant.revolut.com"
    : "https://merchant.revolut.com";

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Revolut-Api-Version": "2024-09-01",
      },
    });

    const data = await response.text();

    res.status(response.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(data);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach Revolut API" });
  }
}
