"use client";
import { useEffect } from "react";
import Icon from "./Icon";
import { STATUS } from "@/lib/format";

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, onSubmit, children, footer, size = "" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const Inner = onSubmit ? "form" : "div";
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Inner className={`modal ${size}`} onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(); } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </Inner>
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function Stat({ label, value, sub, tone = "", icon }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon"><Icon name={icon} size={16} /></span>}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ tone = "gray", children, onClick, title }) {
  const Tag = onClick ? "button" : "span";
  return <Tag type={onClick ? "button" : undefined} title={title} className={`badge ${tone} ${onClick ? "clickable" : ""}`} onClick={onClick}>{children}</Tag>;
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: "gray" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Empty({ title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-mark">C</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Loading() {
  return <div className="loading"><span className="spinner" /> Loading…</div>;
}

export function SaveButtons({ onCancel, saving, label = "Save" }) {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : label}</button>
    </>
  );
}
