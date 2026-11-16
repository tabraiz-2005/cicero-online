"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { money, fmtDate, today, thisMonth, monthRange, EXPENSE_CATS, downloadCSV, n } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Empty, Loading, Modal, Field, SaveButtons, Badge } from "@/components/ui";

export default function Expenses() {
  const { cur, toast } = useApp();
  const [rows, setRows] = useState(null);
  const [month, setMonth] = useState(thisMonth());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const [f, t] = month ? monthRange(month) : ["", ""];
    api(`/expenses?date_from=${f}&date_to=${t}`).then(setRows).catch((e) => toast(e.message, "err"));
  }, [month, toast]);
  useEffect(() => { load(); }, [load]);

  const byCat = useMemo(() => {
    const m = {};
    (rows || []).forEach((r) => { m[r.category] = (m[r.category] || 0) + r.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = (rows || []).reduce((a, r) => a + r.amount, 0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const body = { date: form.date, category: form.category || "Other", amount: n(form.amount), notes: form.notes || "" };
      await api(form.id ? `/expenses/${form.id}` : "/expenses", { method: form.id ? "PUT" : "POST", body });
      toast("Expense saved");
      setForm(null);
      load();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };
  const remove = async (r) => {
    if (!confirm("Delete this expense?")) return;
    try { await api(`/expenses/${r.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { toast(e.message, "err"); }
  };

  return (
    <>
      <PageHead title="Expenses" sub="Packaging, ads, rent and other running costs. These are subtracted from your profit.">
        <button className="btn btn-ghost" disabled={!rows?.length} onClick={() => downloadCSV("cicero-expenses.csv", [
          { label: "Date", value: "date" }, { label: "Category", value: "category" }, { label: "Amount", value: "amount" }, { label: "Notes", value: "notes" },
        ], rows)}><Icon name="download" size={16} /> Export</button>
        <button className="btn btn-primary" onClick={() => setForm({ date: today(), category: "Packaging", amount: "", notes: "" })}><Icon name="plus" size={16} /> Add expense</button>
      </PageHead>

      <div className="toolbar">
        <input className="input auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {month && <button className="btn btn-ghost btn-sm" onClick={() => setMonth("")}>Show all</button>}
        <div className="toolbar-total">Total: <b className="neg">{money(total, cur)}</b></div>
      </div>
      {byCat.length > 0 && (
        <div className="pills mb">
          {byCat.map(([c, v]) => <div className="pill" key={c}><span>{c}</span><b>{money(v, cur)}</b></div>)}
        </div>
      )}

      {!rows ? <Loading /> : rows.length === 0 ? (
        <Empty title="No expenses" text="Add costs like packing material, Facebook ads or rent to see your real profit." />
      ) : (
        <div className="card flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Notes</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td><Badge tone="gray">{r.category}</Badge></td>
                    <td className="muted">{r.notes || "—"}</td>
                    <td className="num strong">{money(r.amount, cur)}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Edit" onClick={() => setForm(r)}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn danger" title="Delete" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} onSubmit={save} title={form?.id ? "Edit expense" : "Add expense"}
        footer={<SaveButtons onCancel={() => setForm(null)} saving={saving} />}>
        {form && (
          <>
            <div className="grid-2">
              <Field label="Date"><input className="input" type="date" value={form.date} onChange={set("date")} required /></Field>
              <Field label="Category">
                <input className="input" list="cats" value={form.category} onChange={set("category")} required />
                <datalist id="cats">{EXPENSE_CATS.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            <Field label={`Amount (${cur})`}><input className="input big" type="number" min="0" step="any" value={form.amount} onChange={set("amount")} required autoFocus /></Field>
            <Field label="Notes"><input className="input" value={form.notes} onChange={set("notes")} placeholder="Optional" /></Field>
          </>
        )}
      </Modal>
    </>
  );
}
