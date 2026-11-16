"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { money, fmtDate, STATUS, ONLINE_STATUSES, SHOP_STATUSES, downloadCSV, thisMonth, monthRange } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Badge, Empty, Loading, Modal } from "@/components/ui";
import SaleModal from "@/components/SaleModal";

export default function Sales() {
  const { cur, toast, settings } = useApp();
  const [rows, setRows] = useState(null);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [pay, setPay] = useState("");
  const [q, setQ] = useState("");
  const [[from, to], setRange] = useState(["", ""]);
  const [modal, setModal] = useState({ open: false, editing: null });
  const [slip, setSlip] = useState(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("channel");
    if (c === "online" || c === "shop") setChannel(c);
  }, []);

  const load = useCallback(() => {
    const p = new URLSearchParams({ channel, status, payment_status: pay, q, date_from: from, date_to: to });
    api(`/sales?${p}`).then(setRows).catch((e) => toast(e.message, "err"));
  }, [channel, status, pay, q, from, to, toast]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const totals = useMemo(() => (rows || []).reduce((a, s) => ({
    bill: a.bill + (s.status === "cancelled" ? 0 : s.revenue), profit: a.profit + s.profit,
    pending: a.pending + (s.payment_status === "unpaid" && !["returned", "cancelled"].includes(s.status) ? s.bill : 0),
  }), { bill: 0, profit: 0, pending: 0 }), [rows]);

  const patch = async (s, body) => {
    try {
      await api(`/sales/${s.id}/status`, { method: "PATCH", body });
      toast("Updated");
      load();
    } catch (e) { toast(e.message, "err"); }
  };
  const remove = async (s) => {
    if (!confirm(`Delete ${s.channel === "online" ? "order" : "sale"} #${s.id}? This can't be undone.`)) return;
    try { await api(`/sales/${s.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  };
  const exportCSV = () => downloadCSV(`cicero-sales-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: "ID", value: "id" }, { label: "Date", value: "date" }, { label: "Type", value: "channel" },
    { label: "Items", value: (s) => s.items.map((i) => `${i.qty}x ${i.name}`).join("; ") },
    { label: "Customer", value: "customer" }, { label: "Phone", value: "phone" }, { label: "City", value: "city" },
    { label: "Courier", value: "courier" }, { label: "Tracking", value: "tracking" }, { label: "Status", value: "status" },
    { label: "Payment", value: "payment_status" }, { label: "Customer pays", value: "bill" },
    { label: "Courier cost", value: "shipping_cost" }, { label: "Goods cost", value: "goods_cost" }, { label: "Profit", value: "profit" },
  ], rows || []);

  const statusOptions = channel === "shop" ? SHOP_STATUSES : channel === "online" ? ONLINE_STATUSES : Object.keys(STATUS);
  const month = from && to && monthRange(from.slice(0, 7))[0] === from && monthRange(from.slice(0, 7))[1] === to ? from.slice(0, 7) : "";

  return (
    <>
      <PageHead title="Sales & Parcels" sub="Shop sales and online orders. Change a parcel's status straight from the list.">
        <button className="btn btn-ghost" onClick={exportCSV} disabled={!rows?.length}><Icon name="download" size={16} /> Export</button>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, editing: null })}><Icon name="plus" size={16} /> New sale</button>
      </PageHead>

      <div className="toolbar">
        <div className="tabs">
          {[["", "All"], ["shop", "🏪 Shop"], ["online", "📦 Online"]].map(([k, l]) => (
            <button key={k} className={channel === k ? "on" : ""} onClick={() => { setChannel(k); setStatus(""); }}>{l}</button>
          ))}
        </div>
        <div className="search"><Icon name="search" size={16} /><input placeholder="Search customer, phone, city, tracking…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <select className="input auto" value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">Any payment</option>
          <option value="paid">Received</option>
          <option value="unpaid">Not received</option>
        </select>
        <input className="input auto" type="month" value={month} onChange={(e) => setRange(e.target.value ? monthRange(e.target.value) : ["", ""])} title="Filter by month" />
        {(from || q || status || pay) && <button className="btn btn-ghost btn-sm" onClick={() => { setRange(["", ""]); setQ(""); setStatus(""); setPay(""); }}>Clear</button>}
      </div>

      {rows && rows.length > 0 && (
        <div className="summary-bar">
          <span><b>{rows.length}</b> {rows.length === 1 ? "entry" : "entries"}</span>
          <span>Sales <b>{money(totals.bill, cur)}</b></span>
          <span>Profit <b className={totals.profit >= 0 ? "pos" : "neg"}>{money(totals.profit, cur)}</b></span>
          <span>To receive <b className={totals.pending ? "warn-text" : ""}>{money(totals.pending, cur)}</b></span>
        </div>
      )}

      {!rows ? <Loading /> : rows.length === 0 ? (
        <Empty title="No sales found" text={q || status || from ? "Try clearing the filters." : "Add your first shop sale or online parcel."}
          action={<button className="btn btn-primary" onClick={() => setModal({ open: true, editing: null })}><Icon name="plus" size={16} /> New sale</button>} />
      ) : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Date</th><th>Products</th><th>Customer</th><th>Courier</th><th className="num">Bill</th><th className="num">Profit</th><th>Status</th><th>Payment</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="muted">{s.channel === "online" ? "📦" : "🏪"} {s.id}</td>
                    <td className="nowrap">{fmtDate(s.date)}</td>
                    <td className="wrap">{s.items.map((i) => <div key={i.id}>{i.qty}× {i.name}</div>)}</td>
                    <td>
                      <div className="strong">{s.customer || (s.channel === "shop" ? "Walk-in" : "—")}</div>
                      <div className="muted small">{[s.phone, s.city].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>
                      {s.channel === "online" ? (<><div>{s.courier || "—"}</div><div className="muted small mono">{s.tracking}</div></>) : <span className="muted">—</span>}
                    </td>
                    <td className="num strong">{money(s.bill, cur)}</td>
                    <td className={`num ${s.profit >= 0 ? "pos" : "neg"}`}>{money(s.profit, cur)}</td>
                    <td>
                      <select className={`status-select ${STATUS[s.status]?.tone}`} value={s.status} onChange={(e) => patch(s, { status: e.target.value })}>
                        {(s.channel === "online" ? ONLINE_STATUSES : SHOP_STATUSES).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                      </select>
                    </td>
                    <td>
                      <Badge tone={s.payment_status === "paid" ? "green" : "amber"} title="Click to change"
                        onClick={() => patch(s, { payment_status: s.payment_status === "paid" ? "unpaid" : "paid" })}>
                        {s.payment_status === "paid" ? "Received" : "Pending"}
                      </Badge>
                    </td>
                    <td className="actions">
                      <button className="icon-btn" title="Print slip" onClick={() => setSlip(s)}><Icon name="printer" size={16} /></button>
                      <button className="icon-btn" title="Edit" onClick={() => setModal({ open: true, editing: s })}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(s)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SaleModal open={modal.open} editing={modal.editing} defaultChannel={channel === "online" ? "online" : "shop"}
        onClose={() => setModal({ open: false, editing: null })} onSaved={load} />

      <Modal open={!!slip} onClose={() => setSlip(null)} title="Print slip"
        footer={<><button className="btn btn-ghost" onClick={() => setSlip(null)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" size={16} /> Print</button></>}>
        {slip && (
          <div className="print-area slip">
            <div className="slip-head">
              <div><div className="slip-brand">{settings.business_name || "Cicero Online"}</div><div className="muted small">{[settings.phone, settings.address].filter(Boolean).join(" · ")}</div></div>
              <div className="right"><div className="strong">#{slip.id}</div><div className="small">{fmtDate(slip.date)}</div></div>
            </div>
            {(slip.customer || slip.address) && (
              <div className="slip-to">
                <div className="muted small">Deliver to</div>
                <div className="strong">{slip.customer}</div>
                <div>{slip.phone}</div>
                <div>{[slip.address, slip.city].filter(Boolean).join(", ")}</div>
                {slip.courier && <div className="small">Courier: {slip.courier} {slip.tracking && `· ${slip.tracking}`}</div>}
              </div>
            )}
            <table className="table slip-table">
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th></tr></thead>
              <tbody>
                {slip.items.map((i) => <tr key={i.id}><td>{i.name}</td><td className="num">{i.qty}</td><td className="num">{money(i.price, cur)}</td><td className="num">{money(i.qty * i.price, cur)}</td></tr>)}
                {slip.discount > 0 && <tr><td colSpan={3}>Discount</td><td className="num">-{money(slip.discount, cur)}</td></tr>}
                {slip.shipping_charged > 0 && <tr><td colSpan={3}>Delivery</td><td className="num">{money(slip.shipping_charged, cur)}</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={3} className="strong">{slip.payment_status === "paid" ? "Total (paid)" : "Amount to collect (COD)"}</td><td className="num strong">{money(slip.bill, cur)}</td></tr></tfoot>
            </table>
            <div className="muted small center">Thank you for shopping with us!</div>
          </div>
        )}
      </Modal>
    </>
  );
}
