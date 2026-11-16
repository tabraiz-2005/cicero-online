"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money, fmtDate, downloadCSV, monthRange } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Empty, Loading, Badge } from "@/components/ui";
import PaymentModal from "@/components/PaymentModal";

export default function Payments() {
  const { cur, toast } = useApp();
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [sup, setSup] = useState("");
  const [month, setMonth] = useState("");
  const [modal, setModal] = useState({ open: false, editing: null });

  const load = useCallback(() => {
    const [f, t] = month ? monthRange(month) : ["", ""];
    const p = new URLSearchParams({ date_from: f, date_to: t });
    if (sup) p.set("supplier_id", sup);
    Promise.all([api(`/payments?${p}`), api("/suppliers")])
      .then(([r, s]) => { setRows(r); setSuppliers(s); })
      .catch((e) => toast(e.message, "err"));
  }, [sup, month, toast]);
  useEffect(() => { load(); }, [load]);

  const remove = async (r) => {
    if (!confirm("Delete this payment? The supplier's pending balance will go back up.")) return;
    try { await api(`/payments/${r.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  };
  const total = (rows || []).reduce((a, r) => a + r.amount, 0);
  const pending = suppliers.reduce((a, s) => a + Math.max(s.balance, 0), 0);

  return (
    <>
      <PageHead title="Supplier Payments" sub="Money you have paid to suppliers">
        <button className="btn btn-ghost" disabled={!rows?.length} onClick={() => downloadCSV("cicero-payments.csv", [
          { label: "Date", value: "date" }, { label: "Supplier", value: "supplier_name" }, { label: "Amount", value: "amount" },
          { label: "Method", value: "method" }, { label: "Reference", value: "reference" }, { label: "Notes", value: "notes" },
        ], rows)}><Icon name="download" size={16} /> Export</button>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, editing: null })}><Icon name="plus" size={16} /> Pay supplier</button>
      </PageHead>

      <div className="toolbar">
        <select className="input auto" value={sup} onChange={(e) => setSup(e.target.value)}>
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {(sup || month) && <button className="btn btn-ghost btn-sm" onClick={() => { setSup(""); setMonth(""); }}>Clear</button>}
        <div className="toolbar-total">Paid: <b className="pos">{money(total, cur)}</b> · Still pending (all): <b className={pending ? "neg" : ""}>{money(pending, cur)}</b></div>
      </div>

      {!rows ? <Loading /> : rows.length === 0 ? (
        <Empty title="No payments yet" text="Record each payment you make to a supplier, and the pending balance updates automatically."
          action={<button className="btn btn-primary" onClick={() => setModal({ open: true, editing: null })}><Icon name="plus" size={16} /> Pay supplier</button>} />
      ) : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Supplier</th><th>Method</th><th>Reference</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td><Link className="link strong" href={`/suppliers/${r.supplier_id}`}>{r.supplier_name}</Link>{r.notes && <div className="muted small">{r.notes}</div>}</td>
                    <td><Badge tone="gray">{r.method}</Badge></td>
                    <td className="muted mono small">{r.reference || "—"}</td>
                    <td className="num strong pos">{money(r.amount, cur)}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Edit" onClick={() => setModal({ open: true, editing: r })}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <PaymentModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} onSaved={load} />
    </>
  );
}
