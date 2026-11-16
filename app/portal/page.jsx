"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, setToken } from "@/lib/api";
import { money, fmtDate, today, downloadCSV, n } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { Badge, Empty, Field, Modal, SaveButtons, Stat } from "@/components/ui";

export default function Portal() {
  const router = useRouter();
  const { toast } = useApp();
  const [me, setMe] = useState(null);
  const [led, setLed] = useState(null);
  const [error, setError] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", new: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([api("/portal/me"), api("/portal/ledger")])
      .then(([m, l]) => { setMe(m); setLed(l); setError(""); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const logout = () => { clearToken(); router.replace("/login"); };
  const changePw = async () => {
    if (pw.new !== pw.confirm) return toast("New passwords don't match", "err");
    setSaving(true);
    try {
      const { token } = await api("/portal/password", { method: "POST", body: { current: pw.current, new: pw.new } });
      setToken(token);
      toast("Password changed");
      setPwOpen(false);
      setPw({ current: "", new: "", confirm: "" });
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };

  if (error) {
    return (
      <div className="portal">
        <Empty title="Couldn't load your account" text={error}
          action={<div className="row gap"><button className="btn btn-ghost" onClick={load}>Try again</button><button className="btn btn-primary" onClick={logout}>Log in again</button></div>} />
      </div>
    );
  }
  if (!me || !led) return <div className="portal"><div className="loading"><span className="spinner" /> Loading…</div></div>;

  const cur = me.business.currency || "Rs";
  const biz = me.business.business_name || "Cicero Online";
  const s = led.supplier;
  const ob = n(s.opening_balance);
  const given = s.purchased + ob;

  const exportCSV = () => downloadCSV(`account-${biz.replace(/\W+/g, "-")}.csv`, [
    { label: "Date", value: "date" }, { label: "Details", value: "description" }, { label: "Bill / Ref", value: "ref" },
    { label: "Goods given", value: "debit" }, { label: "Payment received", value: "credit" }, { label: "Balance pending", value: "balance" },
  ], led.entries);

  return (
    <div className="portal">
      <header className="portal-top">
        <div className="row gap">
          <div className="logo">C</div>
          <div>
            <div className="strong">{biz}</div>
            <div className="muted small">Supplier account</div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPwOpen(true)}><Icon name="lock" size={15} /> <span className="hide-sm">Password</span></button>
          <button className="btn btn-ghost btn-sm" onClick={logout}><Icon name="logout" size={15} /> <span className="hide-sm">Log out</span></button>
        </div>
      </header>

      <main className="portal-main">
        <div className="page-head">
          <div>
            <h1>Assalam o Alaikum, {me.supplier.name}</h1>
            <p>Your live account with {biz} · updated {fmtDate(today())}</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-ghost" onClick={exportCSV}><Icon name="download" size={16} /> Export</button>
            <button className="btn btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> Print</button>
          </div>
        </div>

        <div className="stats">
          <Stat label="Total goods you gave" value={money(given, cur)} sub={ob ? `Includes old balance ${money(ob, cur)}` : null} icon="box" />
          <Stat label="Payments you received" value={money(s.paid, cur)} tone="pos" icon="wallet" />
          <Stat label={s.balance >= 0 ? "Pending to you" : "Advance paid to you"} value={money(Math.abs(s.balance), cur)} tone={s.balance > 0 ? "warn" : "pos"} icon="receipt" />
        </div>

        <div className="card flush print-area">
          <div className="print-only statement-head">
            <div className="slip-brand">{biz}</div>
            <div>Account of <b>{me.supplier.name}</b> · {fmtDate(today())}</div>
            <div>Pending: <b>{money(s.balance, cur)}</b></div>
          </div>
          <div className="card-head"><h3>Account history</h3></div>
          {led.entries.length === 0 && !ob ? (
            <p className="muted pad">No entries yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Details</th><th>Bill / Ref</th><th className="num">Goods given</th><th className="num">Received</th><th className="num">Pending</th></tr></thead>
                <tbody>
                  {ob !== 0 && (
                    <tr><td className="muted">—</td><td>Old balance</td><td /><td className="num">{money(ob, cur)}</td><td /><td className="num strong">{money(ob, cur)}</td></tr>
                  )}
                  {led.entries.map((e) => (
                    <tr key={`${e.kind}-${e.id}`}>
                      <td className="nowrap">{fmtDate(e.date)}</td>
                      <td><Badge tone={e.kind === "purchase" ? "blue" : "green"}>{e.kind === "purchase" ? "Goods" : "Payment"}</Badge> {e.description}</td>
                      <td className="muted small">{e.ref}</td>
                      <td className="num">{e.debit ? money(e.debit, cur) : ""}</td>
                      <td className="num pos">{e.credit ? money(e.credit, cur) : ""}</td>
                      <td className="num strong">{money(e.balance, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {me.show_stock && led.products.length > 0 && (
          <div className="card flush no-print">
            <div className="card-head"><h3>Your products at our shop</h3></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Given</th><th className="num">Sold</th><th className="num">In stock</th></tr></thead>
                <tbody>
                  {led.products.map((p) => (
                    <tr key={p.name}>
                      <td className="strong">{p.name}</td>
                      <td className="num">{p.supplied}</td>
                      <td className="num">{p.sold}</td>
                      <td className="num"><Badge tone={p.stock <= 0 ? "red" : "green"}>{p.stock}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(me.business.phone || me.business.address) && (
          <p className="muted small center">Questions? Contact {biz}{me.business.phone ? ` · ${me.business.phone}` : ""}{me.business.address ? ` · ${me.business.address}` : ""}</p>
        )}
      </main>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} onSubmit={changePw} title="Change password"
        footer={<SaveButtons onCancel={() => setPwOpen(false)} saving={saving} />}>
        <Field label="Current password"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
        <Field label="New password (min 6)"><input className="input" type="password" minLength={6} value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} required /></Field>
        <Field label="Repeat new password"><input className="input" type="password" minLength={6} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
      </Modal>
    </div>
  );
}
