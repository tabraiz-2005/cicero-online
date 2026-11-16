"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { saveBlob } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Field, Badge } from "@/components/ui";

export default function Settings() {
  const { settings, reloadSettings, toast, status } = useApp();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => setForm(settings), [settings]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/settings", { method: "PUT", body: form });
      await reloadSettings();
      toast("Settings saved");
    } catch (err) { toast(err.message, "err"); }
    setSaving(false);
  };

  const backup = async () => {
    try {
      const data = await api("/backup");
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `cicero-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast("Backup downloaded");
    } catch (err) { toast(err.message, "err"); }
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("Restoring will REPLACE all current data with the data in this backup file. Continue?")) return;
    try {
      const payload = JSON.parse(await file.text());
      await api("/restore", { method: "POST", body: payload });
      await reloadSettings();
      toast("Backup restored");
    } catch (err) { toast(err.message || "Invalid file", "err"); }
  };

  return (
    <>
      <PageHead title="Settings" sub="Business details, backups and database" />
      <div className="cols even">
        <form className="card pad-lg" onSubmit={save}>
          <h3>Business details</h3>
          <p className="muted small">Shown in the sidebar and on printed slips and statements.</p>
          <Field label="Business name"><input className="input" value={form.business_name || ""} onChange={set("business_name")} required /></Field>
          <div className="grid-2">
            <Field label="Owner name"><input className="input" value={form.owner || ""} onChange={set("owner")} /></Field>
            <Field label="Currency symbol"><input className="input" value={form.currency || ""} onChange={set("currency")} placeholder="Rs" /></Field>
          </div>
          <Field label="Phone"><input className="input" value={form.phone || ""} onChange={set("phone")} /></Field>
          <Field label="Address"><input className="input" value={form.address || ""} onChange={set("address")} /></Field>
          <Field label="Website link (for sending to suppliers)" hint="Your Vercel address, e.g. https://cicero-online.vercel.app">
            <input className="input" value={form.site_url || ""} onChange={set("site_url")} placeholder="https://….vercel.app" />
          </Field>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
        </form>

        <div className="stack">
          <div className="card pad-lg">
            <h3>Backup &amp; restore</h3>
            <p className="muted small">Download all your data as one file. Keep it safe (Google Drive, USB). You can also use it to move data from your computer to the online version.</p>
            <div className="row gap wrap">
              <button className="btn btn-primary" onClick={backup}><Icon name="download" size={16} /> Download backup</button>
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> Restore from file</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
            </div>
          </div>
          <div className="card pad-lg">
            <h3>System</h3>
            <div className="kv"><span>Database</span><Badge tone={status?.db === "postgres" ? "green" : "blue"}>{status?.db === "postgres" ? "Cloud (PostgreSQL)" : "Local file (SQLite)"}</Badge></div>
            <div className="kv"><span>Password login</span><Badge tone={status?.auth_required ? "green" : "amber"}>{status?.auth_required ? "On" : "Off"}</Badge></div>
            {!status?.auth_required && <p className="muted small">To turn on the password, set <code>APP_PASSWORD</code> in your <code>.env</code> file (or in Vercel environment variables).</p>}
          </div>
        </div>
      </div>
    </>
  );
}
