"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money, n } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Empty, Loading, Stat } from "@/components/ui";
import SupplierForm from "@/components/SupplierForm";
import PaymentModal from "@/components/PaymentModal";
import AccessModal from "@/components/AccessModal";
import { Badge } from "@/components/ui";

export default function Suppliers() {
  const { cur, toast } = useApp();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [access, setAccess] = useState(null);

  const load = useCallback(() => { api("/suppliers").then(setRows).catch((e) => toast(e.message, "err")); }, [toast]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (rows || []).filter((s) => [s.name, s.phone, s.address].some((x) => (x || "").toLowerCase().includes(q.toLowerCase()))), [rows, q]);
  const t = useMemo(() => (rows || []).reduce((a, s) => ({ purchased: a.purchased + s.purchased + n(s.opening_balance), paid: a.paid + s.paid, pending: a.pending + Math.max(s.balance, 0) }), { purchased: 0, paid: 0, pending: 0 }), [rows]);

  const remove = async (s) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try { await api(`/suppliers/${s.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  };

  return (
    <>
      <PageHead title="Suppliers" sub="Stores and people you buy from: what you took, what you paid, what is still pending">
        <button className="btn btn-primary" onClick={() => setForm({})}><Icon name="plus" size={16} /> Add supplier</button>
      </PageHead>

      {rows && rows.length > 0 && (
        <div className="stats small">
          <Stat label="Total stock taken" value={money(t.purchased, cur)} />
          <Stat label="Total paid" value={money(t.paid, cur)} tone="pos" />
          <Stat label="Total pending" value={money(t.pending, cur)} tone={t.pending > 0 ? "neg" : ""} />
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="toolbar"><div className="search"><Icon name="search" size={16} /><input placeholder="Search suppliers…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      )}

      {!rows ? <Loading /> : rows.length === 0 ? (
        <Empty title="No suppliers yet" text="Add the store or person you buy products from. You can rename or edit them anytime."
          action={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="plus" size={16} /> Add supplier</button>} />
      ) : (
        <div className="supplier-grid">
          {shown.map((s) => {
            const total = s.purchased + n(s.opening_balance);
            const pct = total > 0 ? Math.min(100, Math.round((s.paid / total) * 100)) : 100;
            return (
              <div className="card supplier-card" key={s.id}>
                <div className="sc-head">
                  <div className="avatar lg">{s.name[0]?.toUpperCase()}</div>
                  <div className="grow">
                    <Link href={`/suppliers/${s.id}`} className="sc-name">{s.name}</Link>
                    <div className="muted small row" style={{ gap: 6 }}>
                      {s.phone || "No phone"}
                      {s.portal && <Badge tone={s.portal.active ? "green" : "gray"}>{s.portal.active ? "Login on" : "Login off"}</Badge>}
                    </div>
                  </div>
                  <button className="icon-btn" title="Login access for supplier" onClick={() => setAccess(s)}><Icon name="key" size={16} /></button>
                  <button className="icon-btn" title="Edit / rename" onClick={() => setForm(s)}><Icon name="edit" size={16} /></button>
                  <button className="icon-btn danger" title="Delete" onClick={() => remove(s)}><Icon name="trash" size={16} /></button>
                </div>
                <div className="sc-nums">
                  <div><span>Taken</span><b>{money(total, cur)}</b></div>
                  <div><span>Paid</span><b className="pos">{money(s.paid, cur)}</b></div>
                  <div><span>Pending</span><b className={s.balance > 0 ? "neg" : "pos"}>{money(s.balance, cur)}</b></div>
                </div>
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                <div className="sc-actions">
                  <Link href={`/suppliers/${s.id}`} className="btn btn-ghost btn-sm"><Icon name="eye" size={16} /> Statement</Link>
                  <button className="btn btn-primary btn-sm" onClick={() => setPayFor(s.id)}><Icon name="wallet" size={16} /> Pay</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SupplierForm open={!!form} supplier={form} onClose={() => setForm(null)} onSaved={load} />
      <AccessModal open={!!access} supplier={access} onClose={() => setAccess(null)} onSaved={load} />
      <PaymentModal open={!!payFor} supplierId={payFor} onClose={() => setPayFor(null)} onSaved={load} />
    </>
  );
}
