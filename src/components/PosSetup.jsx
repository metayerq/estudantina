import { useState } from "react";
import { C, fontSans, fontMono, Btn, Badge } from "./shared.jsx";
import { POS_PROVIDERS, testRevolutConnection } from "../services/posService.js";

export default function PosSetup({ config, onChange, compact }) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, error? }

  const selectedProvider = POS_PROVIDERS.find((p) => p.id === config.provider);

  const selectProvider = (id) => {
    if (config.provider === id) {
      // Deselect
      onChange({ ...config, provider: null, apiKey: "", connected: false, connectedAt: null });
      setTestResult(null);
    } else {
      onChange({ ...config, provider: id, apiKey: "", connected: false, connectedAt: null });
      setTestResult(null);
    }
  };

  const handleKeyChange = (e) => {
    onChange({ ...config, apiKey: e.target.value, connected: false, connectedAt: null });
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testRevolutConnection(config.apiKey);
    setTesting(false);
    setTestResult(result);
    if (result.success) {
      onChange({ ...config, connected: true, connectedAt: new Date().toISOString() });
    }
  };

  return (
    <div>
      {/* Provider grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: compact ? "repeat(3, 1fr)" : "repeat(3, 1fr)",
        gap: compact ? 8 : 10,
        marginBottom: config.provider ? 20 : 0,
      }}>
        {POS_PROVIDERS.map((p) => {
          const selected = config.provider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => selectProvider(p.id)}
              style={{
                padding: compact ? "10px 8px" : "14px 12px",
                borderRadius: 8,
                border: `2px solid ${selected ? p.color : C.border}`,
                background: selected ? `${p.color}0A` : C.card,
                cursor: "pointer",
                fontFamily: fontSans,
                textAlign: "center",
                transition: "all 0.15s ease",
                position: "relative",
                opacity: p.available ? 1 : 0.7,
              }}
            >
              <div style={{ fontSize: compact ? 18 : 22, marginBottom: 4 }}>{p.icon}</div>
              <div style={{
                fontSize: compact ? 11 : 13, fontWeight: 600,
                color: selected ? p.color : C.text,
              }}>
                {p.name}
              </div>
              {!p.available && (
                <div style={{
                  position: "absolute", top: compact ? 4 : 6, right: compact ? 4 : 6,
                  fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                  color: C.textMuted, background: C.bg, padding: "2px 5px",
                  borderRadius: 4, fontFamily: fontSans, letterSpacing: "0.03em",
                }}>
                  Soon
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Revolut config */}
      {config.provider === "revolut" && (
        <div style={{
          background: C.bg, borderRadius: 8, padding: compact ? 14 : 18,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
            Find your API key in{" "}
            <strong style={{ color: C.text }}>Revolut Business → Merchant API → API keys</strong>
            <br />
            <a
              href="https://business.revolut.com/merchant/developer"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: POS_PROVIDERS[0].color, textDecoration: "none", fontSize: 11 }}
            >
              Open Revolut Dashboard ↗
            </a>
          </div>

          {/* API key input with show/hide */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={handleKeyChange}
              placeholder="sk_live_..."
              style={{
                width: "100%", padding: "10px 40px 10px 12px",
                border: `1px solid ${testResult?.success ? C.green : C.border}`,
                borderRadius: 6, fontFamily: fontMono, fontSize: 13,
                background: C.card, boxSizing: "border-box", outline: "none",
                color: C.text,
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 14, color: C.textMuted, padding: 4,
              }}
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>

          {/* Test + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Btn
              variant="secondary"
              onClick={handleTest}
              disabled={!config.apiKey.trim() || testing}
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              {testing ? "Testing…" : "Test connection"}
            </Btn>

            {testResult && !testing && (
              <div style={{
                fontSize: 12, fontFamily: fontSans,
                color: testResult.success ? C.green : C.red,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {testResult.success ? (
                  <>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%",
                      background: C.greenPale, display: "inline-flex",
                      alignItems: "center", justifyContent: "center", fontSize: 10,
                    }}>✓</span>
                    Connected
                  </>
                ) : (
                  <span>{testResult.error}</span>
                )}
              </div>
            )}

            {testing && (
              <div style={{ fontSize: 12, color: C.textMuted, fontFamily: fontSans }}>
                Checking connection…
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coming soon provider selected */}
      {selectedProvider && !selectedProvider.available && (
        <div style={{
          background: C.bg, borderRadius: 8, padding: compact ? 14 : 18,
          border: `1px solid ${C.border}`, textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: C.textMuted, fontFamily: fontSans }}>
            <strong style={{ color: C.text }}>{selectedProvider.name}</strong> integration is coming soon.
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            We'll notify you when it's available.
          </div>
        </div>
      )}
    </div>
  );
}
