const KEY = "cicero_token";

export function getToken() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}
export function setToken(t) {
  try { localStorage.setItem(KEY, t || ""); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(KEY); } catch {}
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Can't reach the server. Is the Python API running?");
  }
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Please log in");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data?.detail;
    if (typeof d === "string") throw new Error(d);
    if (Array.isArray(d) && d[0]) {
      const field = d[0].loc?.[d[0].loc.length - 1];
      throw new Error(`Please check "${field}": ${d[0].msg}`);
    }
    if (res.status >= 500) throw new Error("Server error. Is the Python API running?");
    throw new Error("Something went wrong");
  }
  return data;
}
