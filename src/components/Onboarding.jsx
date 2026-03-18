import { useState } from "react";
import { C, fontSans, fontMono, CATEGORIES, Btn } from "./shared.jsx";
import { saveOnboarding } from "../services/authService.js";
import { savePosConfig, DEFAULT_POS_CONFIG } from "../services/posService.js";
import PosSetup from "./PosSetup.jsx";

const STEPS = ["cafe", "team", "menu", "pos", "tracking"];

const cardStyle = {
  background: C.card, borderRadius: 10, padding: 32,
  boxShadow: "0 4px 12px rgba(55,53,47,0.08)", maxWidth: 480,
  width: "100%", border: `1px solid ${C.border}`,
};
const inputStyle = {
  width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`,
  borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.card,
  boxSizing: "border-box", outline: "none", color: C.text,
};

export default function Onboarding({ userName, onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    cafeName: "",
    teamSize: 2,
    avgHourlyRate: 9.5,
    categories: ["Coffee"],
    posProvider: null,
    tracksAlready: null,
  });
  const [posConfig, setPosConfig] = useState({ ...DEFAULT_POS_CONFIG });

  const update = (key, value) => setData((prev) => ({ ...prev, [key]: value }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleSkipPos = () => {
    setPosConfig({ ...DEFAULT_POS_CONFIG });
    update("posProvider", null);
    next();
  };

  const handlePosChange = (newConfig) => {
    setPosConfig(newConfig);
    update("posProvider", newConfig.provider);
  };

  const handleFinish = async () => {
    // Save onboarding data (provider name only, not API key)
    await saveOnboarding(data);
    // Save POS config separately (contains API key)
    if (posConfig.provider && posConfig.connected) {
      await savePosConfig(posConfig);
    }
    onComplete(data);
  };

  const toggleCategory = (cat) => {
    update("categories", data.categories.includes(cat)
      ? data.categories.filter((c) => c !== cat)
      : [...data.categories, cat]);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: fontSans, padding: 16,
    }}>
      <div style={cardStyle}>
        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", marginBottom: 6,
            fontSize: 11, color: C.textMuted,
          }}>
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ width: "100%", height: 4, background: C.border, borderRadius: 2 }}>
            <div style={{
              width: `${progress}%`, height: "100%", background: C.text,
              borderRadius: 2, transition: "width 0.3s ease",
            }} />
          </div>
        </div>

        {/* Step content */}
        {step === 0 && (
          <div>
            <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
              Hey {userName || "there"} 👋
            </h2>
            <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 24px" }}>
              Let's set up your café. What's it called?
            </p>
            <label>
              <span style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 500 }}>
                Café name
              </span>
              <input
                value={data.cafeName}
                onChange={(e) => update("cafeName", e.target.value)}
                placeholder="e.g. The Good Cup"
                style={inputStyle}
                autoFocus
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
              Your team
            </h2>
            <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 24px" }}>
              How many people typically work a shift?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>
                <span style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 500 }}>
                  Team size per shift
                </span>
                <input
                  type="number" min="1" max="20"
                  value={data.teamSize}
                  onChange={(e) => update("teamSize", parseInt(e.target.value) || 1)}
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 500 }}>
                  Avg. hourly rate (€)
                </span>
                <input
                  type="number" min="1" step="0.5"
                  value={data.avgHourlyRate}
                  onChange={(e) => update("avgHourlyRate", parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
              What do you serve?
            </h2>
            <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 24px" }}>
              Select all that apply. You can always add more later.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => {
                const selected = data.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    style={{
                      padding: "14px 24px", borderRadius: 8,
                      border: `2px solid ${selected ? C.text : C.border}`,
                      background: selected ? C.text : C.card,
                      color: selected ? "#fff" : C.text,
                      fontFamily: fontSans, fontSize: 14, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s ease",
                      flex: "1 1 auto", textAlign: "center", minWidth: 100,
                    }}
                  >
                    {cat === "Coffee" && "☕ "}{cat === "Pastry" && "🥐 "}{cat === "Kombucha" && "🍵 "}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
              Connect your POS
            </h2>
            <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 20px" }}>
              Import sales data automatically from your point-of-sale.
            </p>
            <PosSetup config={posConfig} onChange={handlePosChange} />
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
              One last thing
            </h2>
            <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 24px" }}>
              Do you currently track your ingredient costs?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { value: false, label: "Not yet", desc: "I'm just getting started" },
                { value: "spreadsheet", label: "With a spreadsheet", desc: "Excel, Google Sheets, etc." },
                { value: "other", label: "With another tool", desc: "POS system, accounting software, etc." },
              ].map((opt) => {
                const selected = data.tracksAlready === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => update("tracksAlready", opt.value)}
                    style={{
                      padding: "14px 18px", borderRadius: 8, textAlign: "left",
                      border: `2px solid ${selected ? C.text : C.border}`,
                      background: selected ? `${C.text}08` : C.card,
                      cursor: "pointer", fontFamily: fontSans,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
          {step > 0 ? (
            <Btn variant="secondary" onClick={prev} style={{ fontSize: 13 }}>← Back</Btn>
          ) : <div />}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Skip link on POS step */}
            {step === 3 && (
              <button
                onClick={handleSkipPos}
                style={{
                  background: "none", border: "none", color: C.textMuted,
                  fontFamily: fontSans, fontSize: 12, cursor: "pointer",
                  textDecoration: "underline", padding: 0,
                }}
              >
                Skip for now
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <Btn onClick={next} style={{ fontSize: 13 }}
                disabled={step === 0 && !data.cafeName.trim()}
              >
                Continue →
              </Btn>
            ) : (
              <Btn onClick={handleFinish} style={{ fontSize: 13 }}
                disabled={data.tracksAlready === null}
              >
                Launch Café Pilot 🚀
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
