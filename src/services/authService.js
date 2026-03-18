import store from "./storage.js";

const USERS_KEY = "cafepilot-users";
const SESSION_KEY = "cafepilot-session";
const ONBOARDING_KEY = "cafepilot-onboarding";

function uid() {
  return "u_" + Math.random().toString(36).slice(2, 10);
}

// Simple hash — NOT secure, prototype only
function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) {
    h = ((h << 5) - h + pw.charCodeAt(i)) | 0;
  }
  return "h_" + Math.abs(h).toString(36);
}

async function getUsers() {
  try {
    const raw = await store.get(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await store.set(USERS_KEY, JSON.stringify(users));
}

export async function register({ name, email, password }) {
  const users = await getUsers();
  const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return { user: null, error: "An account with this email already exists." };

  const user = {
    id: uid(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await saveUsers(users);

  const session = { userId: user.id, email: user.email, name: user.name };
  await store.set(SESSION_KEY, JSON.stringify(session));
  return { user: session, error: null };
}

export async function login({ email, password }) {
  const users = await getUsers();
  const user = users.find((u) => u.email === email.toLowerCase().trim());
  if (!user) return { user: null, error: "No account found with this email." };
  if (user.passwordHash !== hashPassword(password))
    return { user: null, error: "Incorrect password." };

  const session = { userId: user.id, email: user.email, name: user.name };
  await store.set(SESSION_KEY, JSON.stringify(session));
  return { user: session, error: null };
}

export async function getSession() {
  try {
    const raw = await store.get(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function logout() {
  await store.set(SESSION_KEY, "");
  // Clear via localStorage directly as fallback
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export async function getOnboarding() {
  try {
    const raw = await store.get(ONBOARDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveOnboarding(data) {
  const onboarding = { ...data, completedAt: new Date().toISOString() };
  await store.set(ONBOARDING_KEY, JSON.stringify(onboarding));
  return onboarding;
}

export async function isOnboarded() {
  const ob = await getOnboarding();
  return !!(ob && ob.completedAt);
}
