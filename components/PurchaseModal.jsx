"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money, today, n } from "@/lib/format";
import { useApp } from "./Shell";
import { Field, Modal, SaveButtons } from "./ui";

const blank = (supplierId) => ({
  date: today(), supplier_id: supplierId || "", mode: "existing", product_id: "",
  new_product_name: "", new_product_sale_price: "", description: "",
  qty: 1, unit_cost: "", bill_no: "", notes: "", update_cost: true,
});

export default function PurchaseModal({ open, onClose, onSaved, editing, supplierId }) {
  const { toast, cur } = useApp();
  const [form, setForm] = useState(blank(supplierId));
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([api("/suppliers"), api("/products")])
      .then(([s, p]) => { setSuppliers(s); setProducts(p); })
      .catch((e) => toast(e.message, "err"));
    if (editing) {
      setForm({
        ...blank(), ...editing,
        mode: editing.product_id ? "existing" : "other",
        product_id: editing.product_id || "", supplier_id: editing.supplier_id,
        new_product_name: "", new_product_sale_price: "", update_cost: true,
      });
    } else setForm(blank(supplierId));
  }, [open, editing, supplierId, toast]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const pickProduct = (e) => {
    const id = e.target.value;
    const p = products.find((x) => String(x.id) === id);
    setForm((f) => ({
      ...f, product_id: id,
      unit_cost: p && (f.unit_cost === "" || f.unit_cost === 0) ? p.cost_price : f.unit_cost,
      supplier_id: f.supplier_id || (p?.supplier_id ?? ""),
    }));
  };

  const total = n(form.qty) * n(form.unit_cost);

  const save = async () => {
    if (!form.supplier_id) return toast("Please choose a supplier", "err");
    const body = {
      date: form.date, supplier_id: Number(form.supplier_id), qty: n(form.qty), unit_cost: n(form.unit_cost),
      bill_no: form.bill_no, notes: form.notes, update_cost: form.update_cost,
      product_id: form.mode === "existing" && form.product_id ? Number(form.product_id) : null,
      new_product_name: form.mode === "new" ? form.new_product_name : "",
      new_product_sale_price: form.mode === "new" ? n(form.new_product_sale_price) : 0,
      description: form.mode === "other" ? form.description : "",
    };
    setSaving(true);
    try {
      await api(editing ? `/purchases/${editing.id}` : "/purchases", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Stock entry updated" : "Stock added");
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} onSubmit={save} title={editing ? "Edit stock entry" : "Stock in (from supplier)"}
      footer={<SaveButtons onCancel={onClose} saving={saving} />}>
      <div className="grid-2">
        <Field label="Date"><input className="input" type="date" value={form.date} onChange={set("date")} required /></Field>
        <Field label="Supplier">
          <select className="input" value={form.supplier_id} onChange={set("supplier_id")} required>
            <option value="">Choose supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      {suppliers.length === 0 && <p className="hint-box">Add a supplier first on the <b>Suppliers</b> page.</p>}

      <div className="seg">
        {[["existing", "Existing product"], ["new", "New product"], ["other", "Other item"]].map(([k, l]) => (
          <button type="button" key={k} className={form.mode === k ? "on" : ""} onClick={() => setForm((f) => ({ ...f, mode: k }))}>{l}</button>
        ))}
      </div>

      {form.mode === "existing" && (
        <Field label="Product">
          <select className="input" value={form.product_id} onChange={pickProduct} required>
            <option value="">Choose product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock {p.stock})</option>)}
          </select>
        </Field>
      )}
      {form.mode === "new" && (
        <div className="grid-2">
          <Field label="New product name"><input className="input" value={form.new_product_name} onChange={set("new_product_name")} required placeholder="e.g. Ladies watch – gold" /></Field>
          <Field label={`Your selling price (${cur})`}><input className="input" type="number" min="0" step="any" value={form.new_product_sale_price} onChange={set("new_product_sale_price")} /></Field>
        </div>
      )}
      {form.mode === "other" && (
        <Field label="Description" hint="For things you don't track as stock (e.g. packing material)">
          <input className="input" value={form.description} onChange={set("description")} required />
        </Field>
      )}

      <div className="grid-3">
        <Field label="Quantity"><input className="input" type="number" min="1" step="1" value={form.qty} onChange={set("qty")} required /></Field>
        <Field label={`Wholesale price / unit (${cur})`}><input className="input" type="number" min="0" step="any" value={form.unit_cost} onChange={set("unit_cost")} required /></Field>
        <Field label="Bill / invoice no."><input className="input" value={form.bill_no} onChange={set("bill_no")} placeholder="Optional" /></Field>
      </div>
      <Field label="Notes"><input className="input" value={form.notes} onChange={set("notes")} placeholder="Optional" /></Field>
      {form.mode === "existing" && (
        <label className="check"><input type="checkbox" checked={form.update_cost} onChange={set("update_cost")} /> Update the product&apos;s cost price to this price</label>
      )}
      <div className="total-line"><span>Total added to supplier balance</span><b>{money(total, cur)}</b></div>
    </Modal>
  );
}
