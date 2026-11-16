"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money, fmtDate, downloadCSV, monthRange } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Empty, Loading } from "@/components/ui";
import PurchaseModal from "@/components/PurchaseModal";

export default function StockIn() {
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
    Promise.all([api(`/purchases?${p}`), api("/suppliers")])
      .then(([r, s]) => { setRows(r); setSuppliers(s); })
      .catch((e) => toast(e.message, "err"));
  }, [sup, month, toast]);
  useEffect(() => { load(); }, [load]);

  const remove = async (r) => {
    if (!confirm("Delete this stock entry? Stock and supplier balance will be adjusted.")) return;
    try { await api(`/purchases/${r.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  };
  const total = (rows || []).reduce((a, r) => a + r.total, 0);

  return (
    <>
      <PageHead title="Stock In" sub="Every product you took from a supplier. Each entry adds to your stock and to what you owe.">
        <button className="btn btn-ghost" disabled={!rows?.length} onClick={() => downloadCSV("cicero-stock-in.csv", [
          { label: "Date", value: "date" }, { label: "Supplier", value: "supplier_name" }, { label: "Product", value: "product_name" },
          { label: "Qty", value: "qty" }, { label: "Unit cost", value: "unit_cost" }, { label: "Total", value: "total" }, { label: "Bill no", value: "bill_no" },
        ], rows)}><Icon name="download" size={16} /> Export</button>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, editing: null })}><Icon name="plus" size={16} /> Stock in</button>
      </PageHead>

      <div className="toolbar">
        <select className="input auto" value={sup} onChange={(e) => setSup(e.target.value)}>
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="input auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {(sup || month) && <button className="btn btn-ghost btn-sm" onClick={() => { setSup(""); setMonth(""); }}>Clear</button>}
        {rows?.length > 0 && <div className="toolbar-total">Total: <b>{money(total, cur)}</b></div>}
      </div>

      {!rows ? <Loading /> : rows.length === 0 ? (
        <Empty title="No stock entries" text="When you take products from a supplier, add them here."
          action={<button className="btn btn-primary" onClick={() => setModal({ open: true, editing: null })}><Icon name="plus" size={16} /> Stock in</button>} />
      ) : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Supplier</th><th>Product</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Total</th><th>Bill no.</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td><Link className="link" href={`/suppliers/${r.supplier_id}`}>{r.supplier_name}</Link></td>
                    <td className="strong">{r.product_name}{r.notes && <div className="muted small">{r.notes}</div>}</td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{money(r.unit_cost, cur)}</td>
                    <td className="num strong">{money(r.total, cur)}</td>
                    <td className="muted">{r.bill_no || "—"}</td>
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
      <PurchaseModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} onSaved={load} />
    </>
  );
}
