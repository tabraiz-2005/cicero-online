export function money(n, cur = "Rs") {
  const v = Number(n || 0);
  const s = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : ""}${cur} ${s}`;
}

export const num = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const thisMonth = () => today().slice(0, 7);

export function monthRange(m) {
  const [y, mm] = m.split("-").map(Number);
  const last = new Date(y, mm, 0).getDate();
  return [`${m}-01`, `${m}-${String(last).padStart(2, "0")}`];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  if (!m) return s;
  if (!d) return `${MONTHS[+m - 1]} ${y}`;
  return `${+d} ${MONTHS[+m - 1]} ${y}`;
}

export const STATUS = {
  completed: { label: "Completed", tone: "green" },
  pending: { label: "Pending", tone: "amber" },
  packed: { label: "Packed", tone: "blue" },
  shipped: { label: "Shipped", tone: "violet" },
  delivered: { label: "Delivered", tone: "green" },
  returned: { label: "Returned", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
};
export const ONLINE_STATUSES = ["pending", "packed", "shipped", "delivered", "returned", "cancelled"];
export const SHOP_STATUSES = ["completed", "returned", "cancelled"];

export const COURIERS = ["TCS", "Leopards", "PostEx", "Trax", "M&P", "BlueEx", "Call Courier", "Rider", "Daewoo", "Self delivery"];
export const PAY_METHODS = ["Cash", "JazzCash", "Easypaisa", "Bank transfer", "Cheque", "Other"];
export const EXPENSE_CATS = ["Packaging", "Ads / Marketing", "Rent", "Electricity", "Salary", "Transport", "Internet / Phone", "Other"];

export function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export function downloadCSV(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    columns.map((c) => esc(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => esc(typeof c.value === "function" ? c.value(r) : r[c.value])).join(",")),
  ];
  saveBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

export const n = (v) => (v === "" || v == null ? 0 : Number(v));
