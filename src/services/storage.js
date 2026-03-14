const store = {
  async get(k) {
    try { if (window.storage?.get) { const r = await window.storage.get(k); return r?.value ?? null; } } catch {}
    try { return localStorage?.getItem(k) ?? null; } catch { return null; }
  },
  async set(k, v) {
    try { if (window.storage?.set) { await window.storage.set(k, v); return; } } catch {}
    try { localStorage?.setItem(k, v); } catch {}
  },
};

export default store;
