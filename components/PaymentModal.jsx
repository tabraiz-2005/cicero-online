"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money, today, PAY_METHODS, n } from "@/lib/format";
import { useApp } from "./Shell";
import { Field, Modal, SaveButtons } from "./ui";

const blank = (supplierId) => ({ date: today(), supplier_id: supplierId || "", amount: "", method: "Cash", reference: "", notes: "" });

export default function PaymentModal({ open, onClose, onSaved, editing, supplierId }) {
  const { toast, cur } = useApp();
  const [form, setForm] = useState(blank(supplierId));
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api("/suppliers").then(setSuppliers).catch((e) => toast(e.message, "err"));
    setForm(editing ? { ...blank(), ...editing } : blank(supplierId));
  }, [open, editing, supplierId, toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sup = suppliers.find((s) => String(s.id) === String(form.supplier_id));

  const save = async () => {
    if (!form.supplier_id) return toast("Please choose a supplier", "err");
    if (n(form.amount) <= 0) return toast("Amount must be more than 0", "err");
    setSaving(true);
    try {
      const body = { ...form, supplier_id: Number(form.supplier_id), amount: n(form.amount) };
      await api(editing ? `/payments/${editing.id}` : "/payments", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Payment updated" : "Payment saved");
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} onSubmit={save} title={editing ? "Edit payment" : "Pay supplier"}
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
      {sup && (
        <div className="hint-box">
          Currently pending to {sup.name}: <b className={sup.balance > 0 ? "neg" : "pos"}>{money(sup.balance, cur)}</b>
          {sup.balance > 0 && !editing && (
            <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, amount: sup.balance }))}>Pay full amount</button>
          )}
        </div>
      )}
      <div className="grid-2">
        <Field label={`Amount (${cur})`}><input className="input big" type="number" min="0" step="any" value={form.amount} onChange={set("amount")} required autoFocus /></Field>
        <Field label="Method">
          <select className="input" value={form.method} onChange={set("method")}>
            {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Reference / transaction ID"><input className="input" value={form.reference} onChange={set("reference")} placeholder="Optional" /></Field>
      <Field label="Notes"><input className="input" value={form.notes} onChange={set("notes")} placeholder="Optional" /></Field>
      {sup && n(form.amount) > 0 && !editing && (
        <div className="total-line"><span>Balance after this payment</span><b>{money(sup.balance - n(form.amount), cur)}</b></div>
      )}
    </Modal>
  );
}
