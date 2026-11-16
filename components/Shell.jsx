"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, clearToken } from "@/lib/api";
import Icon from "./Icon";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const NAV = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/sales", label: "Sales & Parcels", icon: "bag" },
  { href: "/products", label: "Products", icon: "box" },
  { href: "/stock-in", label: "Stock In", icon: "truck" },
  { href: "/suppliers", label: "Suppliers", icon: "users" },
  { href: "/payments", label: "Payments", icon: "wallet" },
  { href: "/expenses", label: "Expenses", icon: "receipt" },
  { href: "/settings", label: "Settings", icon: "sliders" },
];

export default function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const isPortal = pathname.startsWith("/portal");
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState({ business_name: "Cicero Online", currency: "Rs" });
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const reloadSettings = useCallback(async () => {
    try { setSettings(await api("/settings")); } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    setReady(false);
    (async () => {
      try {
        const st = await api("/status");
        if (!alive) return;
        setStatus(st);
        if (!isLogin && !isPortal) {
          if (st.auth_required && !getToken()) {
            router.replace("/login");
            return;
          }
          const me = await api("/me");
          if (me.role === "supplier") {
            router.replace("/portal");
            return;
          }
          await reloadSettings();
        }
      } catch (e) {
        if (alive) setStatus({ error: e.message });
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [isLogin, isPortal, router, reloadSettings]);

  useEffect(() => setMenu(false), [pathname]);

  const logout = () => { clearToken(); router.replace("/login"); };
  const cur = settings.currency || "Rs";
  const ctx = { settings, status, reloadSettings, toast, cur };
  const name = settings.business_name || "Cicero Online";

  const toastEl = (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <Icon name={t.tone === "err" ? "alert" : "check"} size={16} /> {t.msg}
        </div>
      ))}
    </div>
  );

  if (isLogin || isPortal) return <AppCtx.Provider value={ctx}>{children}{toastEl}</AppCtx.Provider>;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="layout">
        <aside className={`sidebar ${menu ? "open" : ""}`}>
          <div className="brand">
            <div className="logo">C</div>
            <div className="brand-text">
              <div className="brand-name">{name}</div>
              <div className="brand-sub">Shop &amp; online sales</div>
            </div>
          </div>
          <nav className="nav">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
                  <Icon name={item.icon} /> <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="side-foot">
            {status?.auth_required && (
              <button className="nav-link" onClick={logout}><Icon name="logout" /> <span>Log out</span></button>
            )}
            <div className="side-meta">
              <span className={`dot ${status?.db === "postgres" ? "on" : ""}`} />
              {status?.db === "postgres" ? "Cloud database" : "Local database"}
            </div>
          </div>
        </aside>
        {menu && <div className="scrim" onClick={() => setMenu(false)} />}

        <main className="main">
          <div className="mobilebar">
            <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menu"><Icon name="menu" /></button>
            <div className="logo sm">C</div>
            <span className="mobile-name">{name}</span>
          </div>

          {status?.temporary_db && (
            <div className="banner warn">
              <Icon name="alert" size={16} />
              No database is connected on Vercel, so data here is temporary and will be lost. Add DATABASE_URL in Vercel → Settings → Environment Variables.
            </div>
          )}
          {status?.supplier_logins > 0 && !status?.auth_required && (
            <div className="banner err">
              <Icon name="alert" size={16} />
              Supplier logins are on, but no owner password is set, so anyone with the link can open your full dashboard. Set APP_PASSWORD (in .env or in Vercel).
            </div>
          )}
          {status?.db_error && (
            <div className="banner err"><Icon name="alert" size={16} /> Database problem: {status.db_error}</div>
          )}

          <div className="content">
            {status?.error ? (
              <div className="empty">
                <div className="empty-mark err">!</div>
                <h3>Can&apos;t connect to the server</h3>
                <p>{status.error}</p>
                <p className="muted">On your computer, start the app with <code>npm run dev</code> (this starts both the website and the Python API).</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
              </div>
            ) : ready ? children : (
              <div className="loading"><span className="spinner" /> Loading…</div>
            )}
          </div>
        </main>
      </div>
      {toastEl}
    </AppCtx.Provider>
  );
}
