"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { money, fmtDate, n, downloadCSV, today } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { Badge, Empty, Loading, Stat } from "@/components/ui";
import PurchaseModal from "@/components/PurchaseModal";
import PaymentModal from "@/components/PaymentModal";
import SupplierForm from "@/components/SupplierForm";
import AccessModal from "@/components/AccessModal";

export default function SupplierLedger() {
  const { id } = useParams();
  const sid = Number(id);
  const { cur, toast, settings } = useApp();
  const [data, setData] = useState(null);
  const [lists, setLists] = useState({ purchases: [], payments: [] });
  const [modal, setModal] = useState({ kind: null, editing: null });

  const load = useCallback(() => {
    Promise.all([api(`/suppliers/${sid}/ledger`), api(`/purchases?supplier_id=${sid}`), api(`/payments?supplier_id=${sid}`)])
      .then(([l, pu, pa]) => { setData(l); setLists({ purchases: pu, payments: pa }); })
      .catch((e) => { toast(e.message, "err"); setData({ error: e.message }); });
  }, [sid, toast]);
  useEffect(() => { load(); }, [load]);

  const close = useCallback(() => setModal({ kind: null, editing: null }), []);
  const edit = (e) => {
    const list = e.kind === "purchase" ? lists.purchases : lists.payments;
    setModal({ kind: e.kind, editing: list.find((x) => x.id === e.id) });
  };
  const remove = async (e) => {
    if (!confirm(`Delete this ${e.kind === "purchase" ? "stock entry" : "payment"}?`)) return;
    try { await api(`/${e.kind === "purchase" ? "purchases" : "payments"}/${e.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (err) { toast(err.message, "err"); }
  };

  if (!data) return <Loading />;
  if (data.error) return <Empty title="Supplier not found" action={<Link className="btn btn-ghost" href="/suppliers">Back to suppliers</Link>} />;
  const s = data.supplier;
  const ob = n(s.opening_balance);

  const exportCSV = () => downloadCSV(`statement-${s.name.replace(/\W+/g, "-")}.csv`, [
    { label: "Date", value: "date" }, { label: "Details", value: "description" }, { label: "Ref", value: "ref" },
    { label: "Stock taken", value: "debit" }, { label: "Paid", value: "credit" }, { label: "Balance", value: "balance" },
  ], data.entries);

  return (
    <>
      <Link href="/suppliers" className="back"><Icon name="back" size={16} /> All suppliers</Link>
      <div className="page-head">
        <div className="row gap">
          <div className="avatar xl">{s.name[0]?.toUpperCase()}</div>
          <div>
            <h1>{s.name}</h1>
            <p>{[s.phone, s.address].filter(Boolean).join(" · ") || "No contact details"}</p>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setModal({ kind: "access" })}><Icon name="key" size={16} /> Login access</button>
          <button className="btn btn-ghost" onClick={() => setModal({ kind: "supplier" })}><Icon name="edit" size={16} /> Edit</button>
          <button className="btn btn-ghost" onClick={exportCSV}><Icon name="download" size={16} /> Export</button>
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> Print</button>
          <button className="btn btn-ghost" onClick={() => setModal({ kind: "purchase" })}><Icon name="truck" size={16} /> Stock in</button>
          <button className="btn btn-primary" onClick={() => setModal({ kind: "payment" })}><Icon name="wallet" size={16} /> Pay</button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Total stock taken" value={money(s.purchased + ob, cur)} sub={ob ? `Includes opening ${money(ob, cur)}` : null} />
        <Stat label="Total paid" value={money(s.paid, cur)} tone="pos" />
        <Stat label="Pending (you owe)" value={money(s.balance, cur)} tone={s.balance > 0 ? "neg" : "pos"} sub={s.balance < 0 ? "You paid extra (advance)" : null} />
      </div>

      <div className="card flush print-area">
        <div className="print-only statement-head">
          <div className="slip-brand">{settings.business_name || "Cicero Online"}</div>
          <div>Statement for <b>{s.name}</b> · {fmtDate(today())}</div>
          <div>Pending balance: <b>{money(s.balance, cur)}</b></div>
        </div>
        {data.entries.length === 0 && !ob ? (
          <Empty title="No entries yet" text="Use “Stock in” when you take products and “Pay” when you pay this supplier." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Details</th><th>Ref</th><th className="num">Stock taken</th><th className="num">Paid</th><th className="num">Balance</th><th className="no-print" /></tr></thead>
              <tbody>
                {ob !== 0 && (
                  <tr><td className="muted">—</td><td>Opening balance</td><td /><td className="num">{money(ob, cur)}</td><td /><td className="num strong">{money(ob, cur)}</td><td className="no-print" /></tr>
                )}
                {data.entries.map((e) => (
                  <tr key={`${e.kind}-${e.id}`}>
                    <td className="nowrap">{fmtDate(e.date)}</td>
                    <td>
                      <Badge tone={e.kind === "purchase" ? "blue" : "green"}>{e.kind === "purchase" ? "Stock" : "Paid"}</Badge> {e.description}
                      {e.notes && <div className="muted small">{e.notes}</div>}
                    </td>
                    <td className="muted small">{e.ref}</td>
                    <td className="num">{e.debit ? money(e.debit, cur) : ""}</td>
                    <td className="num pos">{e.credit ? money(e.credit, cur) : ""}</td>
                    <td className={`num strong ${e.balance > 0 ? "neg" : ""}`}>{money(e.balance, cur)}</td>
                    <td className="actions no-print">
                      <button className="icon-btn" title="Edit" onClick={() => edit(e)}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(e)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseModal open={modal.kind === "purchase"} editing={modal.editing} supplierId={sid} onClose={close} onSaved={load} />
      <PaymentModal open={modal.kind === "payment"} editing={modal.editing} supplierId={sid} onClose={close} onSaved={load} />
      <AccessModal open={modal.kind === "access"} supplier={s} onClose={close} onSaved={load} />
      <SupplierForm open={modal.kind === "supplier"} supplier={s} onClose={close} onSaved={load} />
    </>
  );
}
