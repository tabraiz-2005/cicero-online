"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { n } from "@/lib/format";
import { useApp } from "./Shell";
import { Field, Modal, SaveButtons } from "./ui";

const blank = { name: "", phone: "", address: "", notes: "", opening_balance: "" };

export default function SupplierForm({ open, supplier, onClose, onSaved }) {
  const { toast, cur } = useApp();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm({ ...blank, ...(supplier || {}) }); }, [open, supplier]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const editing = !!supplier?.id;

  const save = async () => {
    setSaving(true);
    try {
      const body = { name: form.name, phone: form.phone || "", address: form.address || "", notes: form.notes || "", opening_balance: n(form.opening_balance) };
      await api(editing ? `/suppliers/${supplier.id}` : "/suppliers", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Supplier updated" : "Supplier added");
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} onSubmit={save} title={editing ? "Edit supplier" : "Add supplier"}
      footer={<SaveButtons onCancel={onClose} saving={saving} />}>
      <Field label="Store / supplier name"><input className="input" value={form.name} onChange={set("name")} required autoFocus placeholder="e.g. Ali Traders, Shah Alam Market" /></Field>
      <div className="grid-2">
        <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} /></Field>
        <Field label={`Opening balance (${cur})`} hint="Amount you already owed before using this app"><input className="input" type="number" step="any" value={form.opening_balance} onChange={set("opening_balance")} /></Field>
      </div>
      <Field label="Address"><input className="input" value={form.address} onChange={set("address")} /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={set("notes")} /></Field>
    </Modal>
  );
}
