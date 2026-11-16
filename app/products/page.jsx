"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { money, downloadCSV, n } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Badge, Empty, Loading, Modal, Field, SaveButtons, Stat } from "@/components/ui";
import PurchaseModal from "@/components/PurchaseModal";

const blank = { name: "", sku: "", category: "", supplier_id: "", cost_price: "", sale_price: "", opening_stock: 0, low_stock: 3, notes: "" };

export default function Products() {
  const { cur, toast } = useApp();
  const [rows, setRows] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([api("/products"), api("/suppliers")])
      .then(([p, s]) => { setRows(p); setSuppliers(s); })
      .catch((e) => toast(e.message, "err"));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (rows || []).filter((p) => {
    const t = q.toLowerCase();
    if (t && ![p.name, p.sku, p.category, p.supplier_name].some((x) => (x || "").toLowerCase().includes(t))) return false;
    if (filter === "low") return p.stock <= p.low_stock;
    if (filter === "in") return p.stock > 0;
    return true;
  }), [rows, q, filter]);

  const totals = useMemo(() => (rows || []).reduce((a, p) => ({
    units: a.units + Math.max(p.stock, 0), cost: a.cost + Math.max(p.stock, 0) * p.cost_price, retail: a.retail + Math.max(p.stock, 0) * p.sale_price,
  }), { units: 0, cost: 0, retail: 0 }), [rows]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form, supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        cost_price: n(form.cost_price), sale_price: n(form.sale_price), opening_stock: Math.round(n(form.opening_stock)), low_stock: Math.round(n(form.low_stock)),
      };
      await api(form.id ? `/products/${form.id}` : "/products", { method: form.id ? "PUT" : "POST", body });
      toast(form.id ? "Product updated" : "Product added");
      setForm(null);
      load();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };
  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await api(`/products/${p.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  };
  const margin = (p) => (p.sale_price > 0 ? Math.round(((p.sale_price - p.cost_price) / p.sale_price) * 100) : 0);
  const exportCSV = () => downloadCSV("cicero-products.csv", [
    { label: "Name", value: "name" }, { label: "SKU", value: "sku" }, { label: "Category", value: "category" },
    { label: "Supplier", value: "supplier_name" }, { label: "Cost price", value: "cost_price" }, { label: "Sale price", value: "sale_price" },
    { label: "Stock", value: "stock" }, { label: "Bought", value: "bought" }, { label: "Sold", value: "sold" },
  ], rows || []);

  const formProfit = form ? n(form.sale_price) - n(form.cost_price) : 0;

  return (
    <>
      <PageHead title="Products" sub="Wholesale cost, your selling price and live stock for every product">
        <button className="btn btn-ghost" onClick={exportCSV} disabled={!rows?.length}><Icon name="download" size={16} /> Export</button>
        <button className="btn btn-ghost" onClick={() => setStockOpen(true)}><Icon name="truck" size={16} /> Stock in</button>
        <button className="btn btn-primary" onClick={() => setForm({ ...blank })}><Icon name="plus" size={16} /> Add product</button>
      </PageHead>

      {rows && rows.length > 0 && (
        <div className="stats small">
          <Stat label="Products" value={rows.length} />
          <Stat label="Units in stock" value={totals.units} />
          <Stat label="Stock value (your cost)" value={money(totals.cost, cur)} />
          <Stat label="Stock value (selling price)" value={money(totals.retail, cur)} sub={`Possible profit ${money(totals.retail - totals.cost, cur)}`} />
        </div>
      )}

      <div className="toolbar">
        <div className="search"><Icon name="search" size={16} /><input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="tabs">
          {[["", "All"], ["in", "In stock"], ["low", "Low / out"]].map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      {!rows ? <Loading /> : shown.length === 0 ? (
        <Empty title={rows.length ? "No matching products" : "No products yet"} text="Add a product, or use Stock in to add products as you buy them."
          action={<button className="btn btn-primary" onClick={() => setForm({ ...blank })}><Icon name="plus" size={16} /> Add product</button>} />
      ) : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th>Supplier</th><th className="num">Your cost</th><th className="num">Sell price</th><th className="num">Profit / unit</th><th className="num">Stock</th><th className="num">Sold</th><th /></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td><div className="strong">{p.name}</div><div className="muted small">{[p.sku, p.category].filter(Boolean).join(" · ")}</div></td>
                    <td>{p.supplier_name || <span className="muted">—</span>}</td>
                    <td className="num">{money(p.cost_price, cur)}</td>
                    <td className="num strong">{money(p.sale_price, cur)}</td>
                    <td className={`num ${p.sale_price - p.cost_price >= 0 ? "pos" : "neg"}`}>{money(p.sale_price - p.cost_price, cur)} <span className="muted small">({margin(p)}%)</span></td>
                    <td className="num"><Badge tone={p.stock <= 0 ? "red" : p.stock <= p.low_stock ? "amber" : "green"}>{p.stock}</Badge></td>
                    <td className="num muted">{p.sold}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Edit" onClick={() => setForm({ ...p, supplier_id: p.supplier_id || "" })}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(p)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} onSubmit={save} title={form?.id ? "Edit product" : "Add product"}
        footer={<SaveButtons onCancel={() => setForm(null)} saving={saving} />}>
        {form && (
          <>
            <Field label="Product name"><input className="input" value={form.name} onChange={set("name")} required autoFocus /></Field>
            <div className="grid-3">
              <Field label="Code / SKU"><input className="input" value={form.sku} onChange={set("sku")} placeholder="Optional" /></Field>
              <Field label="Category"><input className="input" value={form.category} onChange={set("category")} placeholder="Optional" /></Field>
              <Field label="Main supplier">
                <select className="input" value={form.supplier_id} onChange={set("supplier_id")}>
                  <option value="">None</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid-2">
              <Field label={`Your cost / wholesale (${cur})`}><input className="input" type="number" min="0" step="any" value={form.cost_price} onChange={set("cost_price")} /></Field>
              <Field label={`Selling price (${cur})`}><input className="input" type="number" min="0" step="any" value={form.sale_price} onChange={set("sale_price")} /></Field>
            </div>
            <div className="grid-2">
              <Field label="Opening stock" hint="Stock you already have. New stock is added with “Stock in”."><input className="input" type="number" step="1" value={form.opening_stock} onChange={set("opening_stock")} /></Field>
              <Field label="Low-stock alert at"><input className="input" type="number" min="0" step="1" value={form.low_stock} onChange={set("low_stock")} /></Field>
            </div>
            <Field label="Notes"><input className="input" value={form.notes} onChange={set("notes")} placeholder="Optional" /></Field>
            <div className="total-line"><span>Profit per unit</span><b className={formProfit >= 0 ? "pos" : "neg"}>{money(formProfit, cur)}</b></div>
          </>
        )}
      </Modal>
      <PurchaseModal open={stockOpen} onClose={() => setStockOpen(false)} onSaved={load} />
    </>
  );
}
