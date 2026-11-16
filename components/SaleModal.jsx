"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money, today, n, COURIERS, STATUS, ONLINE_STATUSES, SHOP_STATUSES } from "@/lib/format";
import { useApp } from "./Shell";
import Icon from "./Icon";
import { Field, Modal, SaveButtons } from "./ui";

const blankItem = () => ({ product_id: "", name: "", qty: 1, price: "", cost: "" });
const blank = (channel = "shop") => ({
  date: today(), channel, customer: "", phone: "", city: "", address: "", courier: "", tracking: "",
  status: channel === "online" ? "pending" : "completed", payment_status: channel === "online" ? "unpaid" : "paid",
  discount: "", shipping_charged: "", shipping_cost: "", other_cost: "", notes: "", items: [blankItem()],
});

export default function SaleModal({ open, onClose, onSaved, editing, defaultChannel = "shop" }) {
  const { toast, cur } = useApp();
  const [form, setForm] = useState(blank(defaultChannel));
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api("/products").then(setProducts).catch((e) => toast(e.message, "err"));
    if (editing) {
      setForm({ ...blank(editing.channel), ...editing, items: editing.items.map((i) => ({ ...i, product_id: i.product_id || "" })) });
    } else setForm(blank(defaultChannel));
  }, [open, editing, defaultChannel, toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setChannel = (c) => setForm((f) => ({
    ...f, channel: c,
    status: c === "online"
      ? (f.status === "completed" ? "pending" : f.status)
      : (["pending", "packed", "shipped", "delivered"].includes(f.status) ? "completed" : f.status),
    payment_status: editing ? f.payment_status : c === "online" ? "unpaid" : "paid",
  }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const pick = (i, id) => {
    const p = products.find((x) => String(x.id) === String(id));
    setForm((f) => ({
      ...f,
      items: f.items.map((it, j) => (j === i ? { ...it, product_id: id, name: p ? p.name : it.name, price: p ? p.sale_price : it.price, cost: p ? p.cost_price : it.cost } : it)),
    }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const subtotal = form.items.reduce((s, it) => s + n(it.qty) * n(it.price), 0);
  const goods = form.items.reduce((s, it) => s + n(it.qty) * n(it.cost), 0);
  const bill = subtotal - n(form.discount) + n(form.shipping_charged);
  const profit = bill - goods - n(form.shipping_cost) - n(form.other_cost);
  const online = form.channel === "online";
  const statuses = online ? ONLINE_STATUSES : SHOP_STATUSES;

  const save = async () => {
    const items = form.items.filter((it) => it.product_id || it.name.trim());
    if (!items.length) return toast("Add at least one product", "err");
    setSaving(true);
    try {
      const body = {
        ...form,
        discount: n(form.discount), shipping_charged: n(form.shipping_charged),
        shipping_cost: n(form.shipping_cost), other_cost: n(form.other_cost),
        items: items.map((it) => ({
          product_id: it.product_id ? Number(it.product_id) : null, name: it.name || "",
          qty: n(it.qty) || 1, price: n(it.price), cost: it.cost === "" ? null : n(it.cost),
        })),
      };
      delete body.id; delete body.created_at;
      await api(editing ? `/sales/${editing.id}` : "/sales", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Sale updated" : online ? "Order saved" : "Sale saved");
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} onSubmit={save} size="wide"
      title={editing ? `Edit ${online ? "order" : "sale"} #${editing.id}` : online ? "New online order / parcel" : "New shop sale"}
      footer={<SaveButtons onCancel={onClose} saving={saving} label={editing ? "Save changes" : "Save"} />}>
      <div className="seg">
        <button type="button" className={!online ? "on" : ""} onClick={() => setChannel("shop")}>🏪 Shop sale</button>
        <button type="button" className={online ? "on" : ""} onClick={() => setChannel("online")}>📦 Online / parcel</button>
      </div>

      <div className="grid-3">
        <Field label="Date"><input className="input" type="date" value={form.date} onChange={set("date")} required /></Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={set("status")}>
            {statuses.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
        </Field>
        <Field label="Payment">
          <select className="input" value={form.payment_status} onChange={set("payment_status")}>
            <option value="paid">Received</option>
            <option value="unpaid">{online ? "Not received (COD pending)" : "Not received (credit)"}</option>
          </select>
        </Field>
      </div>

      <div className="section-title">Products</div>
      <div className="items">
        <div className="items-head">
          <span>Product</span><span>Qty</span><span>Sell price</span><span>Your cost</span><span>Total</span><span />
        </div>
        {form.items.map((it, i) => {
          const p = products.find((x) => String(x.id) === String(it.product_id));
          return (
            <div className="items-row" key={i}>
              <div>
                <select className="input" value={it.product_id} onChange={(e) => pick(i, e.target.value)}>
                  <option value="">{it.name && !it.product_id ? it.name : "Choose product…"}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} · stock {p.stock}</option>)}
                </select>
                {p && n(it.qty) > p.stock + (editing?.items.find((x) => x.product_id === p.id)?.qty || 0) && (
                  <small className="warn-text">Only {p.stock} in stock</small>
                )}
              </div>
              <input className="input" type="number" min="1" step="1" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} aria-label="Quantity" />
              <input className="input" type="number" min="0" step="any" value={it.price} onChange={(e) => setItem(i, "price", e.target.value)} aria-label="Selling price" />
              <input className="input" type="number" min="0" step="any" value={it.cost} onChange={(e) => setItem(i, "cost", e.target.value)} aria-label="Cost price" />
              <span className="items-total">{money(n(it.qty) * n(it.price), cur)}</span>
              <button type="button" className="icon-btn danger" onClick={() => removeItem(i)} disabled={form.items.length === 1} aria-label="Remove"><Icon name="trash" size={16} /></button>
            </div>
          );
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}><Icon name="plus" size={16} /> Add another product</button>
      </div>

      <div className="section-title">{online ? "Customer & parcel" : "Customer (optional)"}</div>
      <div className="grid-3">
        <Field label="Customer name"><input className="input" value={form.customer} onChange={set("customer")} /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} /></Field>
        {online && <Field label="City"><input className="input" value={form.city} onChange={set("city")} /></Field>}
      </div>
      {online && (
        <>
          <Field label="Address"><input className="input" value={form.address} onChange={set("address")} /></Field>
          <div className="grid-2">
            <Field label="Courier">
              <input className="input" list="couriers" value={form.courier} onChange={set("courier")} placeholder="TCS, Leopards, PostEx…" />
              <datalist id="couriers">{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Tracking number"><input className="input" value={form.tracking} onChange={set("tracking")} /></Field>
          </div>
        </>
      )}

      <div className="section-title">Charges &amp; costs</div>
      <div className="grid-4">
        <Field label={`Discount (${cur})`}><input className="input" type="number" min="0" step="any" value={form.discount} onChange={set("discount")} /></Field>
        {online && <Field label="Delivery charged to customer" hint="Added to the bill"><input className="input" type="number" min="0" step="any" value={form.shipping_charged} onChange={set("shipping_charged")} /></Field>}
        {online && <Field label="Courier cost (you pay)" hint="Shipping cost for you"><input className="input" type="number" min="0" step="any" value={form.shipping_cost} onChange={set("shipping_cost")} /></Field>}
        <Field label="Packing / other cost"><input className="input" type="number" min="0" step="any" value={form.other_cost} onChange={set("other_cost")} /></Field>
      </div>
      <Field label="Notes"><input className="input" value={form.notes} onChange={set("notes")} placeholder="Optional" /></Field>

      <div className="summary">
        <div><span>Products</span><b>{money(subtotal, cur)}</b></div>
        <div><span>Customer pays</span><b>{money(bill, cur)}</b></div>
        <div><span>Your cost (goods + delivery + packing)</span><b>{money(goods + n(form.shipping_cost) + n(form.other_cost), cur)}</b></div>
        <div className={profit >= 0 ? "pos" : "neg"}><span>Profit</span><b>{money(profit, cur)}</b></div>
      </div>
    </Modal>
  );
}
