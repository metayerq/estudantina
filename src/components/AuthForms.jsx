import { useState } from "react";
import { C, fontSans, fontMono, Btn } from "./shared.jsx";
import { register, login } from "../services/authService.js";

const inputStyle = {
  width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`,
  borderRadius: 6, fontFamily: fontSans, fontSize: 14, background: C.card,
  boxSizing: "border-box", outline: "none", color: C.text,
};
const labelStyle = {
  display: "block", marginBottom: 14,
};
const labelTextStyle = {
  fontFamily: fontSans, fontSize: 12, color: C.textMuted,
  display: "block", marginBottom: 4, fontWeight: 500,
};
const cardStyle = {
  background: C.card, borderRadius: 10, padding: 32,
  boxShadow: "0 4px 12px rgba(55,53,47,0.08)", maxWidth: 400,
  width: "100%", border: `1px solid ${C.border}`,
};

export function RegisterForm({ onRegister, onSwitchToLogin, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = name.trim() && email.includes("@") && password.length >= 6 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    const result = await register({ name, email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      onRegister(result.user);
    }
  };

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: fontSans, padding: 16,
    }}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>☕</div>
          <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>
            Create your account
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "6px 0 0" }}>
            Start managing your café costs
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria" style={inputStyle} autoFocus />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@cafe.pt" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6+ characters" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Confirm password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" style={inputStyle} />
          </label>

          {error && (
            <div style={{ color: C.red, fontSize: 13, marginBottom: 12, fontFamily: fontSans }}>{error}</div>
          )}
          {password && confirm && password !== confirm && (
            <div style={{ color: C.amber, fontSize: 12, marginBottom: 12, fontFamily: fontSans }}>Passwords don't match</div>
          )}

          <Btn onClick={() => {}} disabled={!valid || loading} style={{ width: "100%", fontSize: 14, padding: "10px 0", marginBottom: 12, textAlign: "center", display: "block" }}>
            {loading ? "Creating account…" : "Create account"}
          </Btn>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, color: C.textMuted }}>
          Already have an account?{" "}
          <button onClick={onSwitchToLogin} style={{
            background: "none", border: "none", color: C.text, fontWeight: 600,
            cursor: "pointer", fontFamily: fontSans, fontSize: 13, padding: 0,
          }}>Log in</button>
        </div>
      </div>

      <button onClick={onBack} style={{
        background: "none", border: "none", color: C.textMuted,
        fontFamily: fontSans, fontSize: 13, cursor: "pointer", marginTop: 16,
      }}>← Back to home</button>
    </div>
  );
}

export function LoginForm({ onLogin: onLoginSuccess, onSwitchToRegister, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = email.includes("@") && password.length >= 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    const result = await login({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      onLoginSuccess(result.user);
    }
  };

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: fontSans, padding: 16,
    }}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>☕</div>
          <h2 style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "6px 0 0" }}>
            Log in to your Café Pilot account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@cafe.pt" style={inputStyle} autoFocus />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" style={inputStyle} />
          </label>

          {error && (
            <div style={{ color: C.red, fontSize: 13, marginBottom: 12, fontFamily: fontSans }}>{error}</div>
          )}

          <Btn onClick={() => {}} disabled={!valid || loading} style={{ width: "100%", fontSize: 14, padding: "10px 0", marginBottom: 12, textAlign: "center", display: "block" }}>
            {loading ? "Logging in…" : "Log in"}
          </Btn>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, color: C.textMuted }}>
          Don't have an account?{" "}
          <button onClick={onSwitchToRegister} style={{
            background: "none", border: "none", color: C.text, fontWeight: 600,
            cursor: "pointer", fontFamily: fontSans, fontSize: 13, padding: 0,
          }}>Get started</button>
        </div>
      </div>

      <button onClick={onBack} style={{
        background: "none", border: "none", color: C.textMuted,
        fontFamily: fontSans, fontSize: 13, cursor: "pointer", marginTop: 16,
      }}>← Back to home</button>
    </div>
  );
}
