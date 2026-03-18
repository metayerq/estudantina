import { useState, useEffect } from "react";
import { getSession, logout as doLogout, isOnboarded, getOnboarding } from "./services/authService.js";
import LandingPage from "./components/LandingPage.jsx";
import { RegisterForm, LoginForm } from "./components/AuthForms.jsx";
import Onboarding from "./components/Onboarding.jsx";
import App from "./App.jsx";

export default function AppRoot() {
  const [screen, setScreen] = useState("loading");
  const [session, setSession] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        setScreen("landing");
        return;
      }
      setSession(s);
      const onboarded = await isOnboarded();
      if (!onboarded) {
        setScreen("onboarding");
      } else {
        const ob = await getOnboarding();
        setOnboardingData(ob);
        setScreen("app");
      }
    })();
  }, []);

  const handleRegister = async (user) => {
    setSession(user);
    setScreen("onboarding");
  };

  const handleLogin = async (user) => {
    setSession(user);
    const onboarded = await isOnboarded();
    if (!onboarded) {
      setScreen("onboarding");
    } else {
      const ob = await getOnboarding();
      setOnboardingData(ob);
      setScreen("app");
    }
  };

  const handleOnboardingComplete = async (data) => {
    setOnboardingData(data);
    setScreen("app");
  };

  const handleLogout = async () => {
    await doLogout();
    setSession(null);
    setOnboardingData(null);
    setScreen("landing");
  };

  if (screen === "loading") {
    return null; // Brief flash, nearly instant
  }

  if (screen === "landing") {
    return (
      <LandingPage
        onGetStarted={() => setScreen("register")}
        onLogin={() => setScreen("login")}
      />
    );
  }

  if (screen === "register") {
    return (
      <RegisterForm
        onRegister={handleRegister}
        onSwitchToLogin={() => setScreen("login")}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "login") {
    return (
      <LoginForm
        onLogin={handleLogin}
        onSwitchToRegister={() => setScreen("register")}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "onboarding") {
    return (
      <Onboarding
        userName={session?.name}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // screen === "app"
  return (
    <App
      user={session}
      onLogout={handleLogout}
      cafeName={onboardingData?.cafeName}
    />
  );
}
