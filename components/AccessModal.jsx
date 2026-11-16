"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./Shell";
import Icon from "./Icon";
import { Field, Modal, Badge } from "./ui";

const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "supplier";
const genPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  arr.forEach((v) => { p += chars[v % chars.length]; });
  return p;
};
const waNumber = (phone) => {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "92" + d.slice(1);
  return d;
};

export default function AccessModal({ open, supplier, onClose, onSaved }) {
  const { toast, settings } = useApp();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", active: true, show_stock: false });
  const [shared, setShared] = useState(null); // {username, password}
  const [saving, setSaving] = useState(false);

  const sid = supplier?.id;
  const sname = supplier?.name;
  useEffect(() => {
    if (!open || !sid) return;
    setShared(null);
    setInfo(null);
    api(`/suppliers/${sid}/access`).then((d) => {
      setInfo(d);
      setForm(d.exists
        ? { username: d.username, password: "", active: d.active, show_stock: d.show_stock }
        : { username: slug(sname), password: genPassword(), active: true, show_stock: false });
    }).catch((e) => toast(e.message, "err"));
  }, [open, sid, sname, toast]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);
  const base = (settings.site_url || (isLocal ? "" : origin)).replace(/\/+$/, "");
  const link = base ? `${base}/login` : "(your website link)/login";

  const save = async () => {
    setSaving(true);
    try {
      const d = await api(`/suppliers/${supplier.id}/access`, { method: "PUT", body: form });
      setInfo(d);
      toast(info?.exists ? "Login updated" : "Login created");
      if (form.password) setShared({ username: d.username, password: form.password });
      setForm((f) => ({ ...f, password: "" }));
      onSaved?.();
    } catch (e) { toast(e.message, "err"); }
    setSaving(false);
  };

  const removeAccess = async () => {
    if (!confirm(`Remove login for ${supplier.name}? They will not be able to log in anymore.`)) return;
    try {
      await api(`/suppliers/${supplier.id}/access`, { method: "DELETE" });
      toast("Login removed");
      onSaved?.();
      onClose();
    } catch (e) { toast(e.message, "err"); }
  };

  const message = shared
    ? `Assalam o Alaikum ${supplier?.name}!\n\nYou can now see your account with ${settings.business_name || "Cicero Online"} (stock given, payments received and pending balance) online:\n\n${link}\nUsername: ${shared.username}\nPassword: ${shared.password}\n\nOn the login page, choose "Supplier".`
    : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); toast("Copied"); } catch { toast("Copy failed – select the text and copy", "err"); }
  };

  return (
    <Modal open={open} onClose={onClose} onSubmit={shared ? undefined : save} title={`Login access · ${supplier?.name || ""}`}
      footer={shared ? (
        <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
      ) : (
        <>
          {info?.exists && <button type="button" className="btn btn-ghost danger-text" onClick={removeAccess} style={{ marginRight: "auto" }}>Remove login</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !info}>{saving ? "Saving…" : info?.exists ? "Save" : "Create login"}</button>
        </>
      )}>
      {!info ? <p className="muted">Loading…</p> : shared ? (
        <>
          <div className="hint-box">
            <b>Login ready.</b> Send these details to the supplier now. For safety the password is shown only once. You can always set a new one later.
          </div>
          <textarea className="input share-text" rows={9} readOnly value={message} onFocus={(e) => e.target.select()} />
          {!base && <p className="warn-text">Tip: add your Vercel link in Settings → “Website link” so the message has the right address.</p>}
          <div className="row gap wrap">
            <button type="button" className="btn btn-ghost" onClick={copy}><Icon name="copy" size={16} /> Copy message</button>
            <a className="btn btn-whatsapp" target="_blank" rel="noreferrer"
              href={`https://wa.me/${waNumber(supplier?.phone)}?text=${encodeURIComponent(message)}`}>
              <Icon name="share" size={16} /> Send on WhatsApp
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            The supplier logs in and sees <b>only their own account</b>: stock they gave you, payments you made and the pending balance.
            They can&apos;t see your sales, profit, other suppliers or your private notes.
          </p>
          {info.exists && (
            <div className="kv"><span>Status</span>
              <span className="row gap">
                <Badge tone={info.active ? "green" : "gray"}>{info.active ? "Active" : "Turned off"}</Badge>
                <span className="muted small">{info.last_login ? `Last login ${info.last_login.replace("T", " ").slice(0, 16)}` : "Never logged in"}</span>
              </span>
            </div>
          )}
          <div className="grid-2" style={{ marginTop: 12 }}>
            <Field label="Username"><input className="input" value={form.username} onChange={set("username")} required autoCapitalize="none" /></Field>
            <Field label={info.exists ? "New password (leave empty to keep)" : "Password"}>
              <div className="row" style={{ gap: 6 }}>
                <input className="input mono" value={form.password} onChange={set("password")} required={!info.exists} minLength={6} placeholder={info.exists ? "••••••" : ""} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, password: genPassword() }))}>New</button>
              </div>
            </Field>
          </div>
          <label className="check"><input type="checkbox" checked={form.active} onChange={set("active")} /> Login is active (untick to block this supplier)</label>
          <label className="check"><input type="checkbox" checked={form.show_stock} onChange={set("show_stock")} /> Also show them how many of their products are sold and still in stock (no prices or profit shown)</label>
        </>
      )}
    </Modal>
  );
}
