"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money, num, fmtDate, thisMonth, STATUS } from "@/lib/format";
import { useApp } from "@/components/Shell";
import Icon from "@/components/Icon";
import { PageHead, Stat, StatusBadge, Loading, Badge } from "@/components/ui";
import SaleModal from "@/components/SaleModal";
import PurchaseModal from "@/components/PurchaseModal";
import PaymentModal from "@/components/PaymentModal";

export default function Dashboard() {
  const { cur, toast, settings } = useApp();
  const [month, setMonth] = useState(thisMonth());
  const [d, setD] = useState(null);
  const [modal, setModal] = useState(null); // "shop" | "online" | "stock" | "pay"

  const load = useCallback(() => {
    api(`/dashboard?month=${month}`).then(setD).catch((e) => toast(e.message, "err"));
  }, [month, toast]);
  useEffect(() => { load(); }, [load]);

  const close = useCallback(() => setModal(null), []);

  return (
    <>
      <PageHead title={`Welcome to ${settings.business_name || "Cicero Online"}`} sub="Your shop, parcels, stock and supplier money in one place">
        <input className="input month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      </PageHead>

      <div className="quick">
        <button className="quick-btn" onClick={() => setModal("shop")}><span className="qi green"><Icon name="bag" /></span>New shop sale</button>
        <button className="quick-btn" onClick={() => setModal("online")}><span className="qi violet"><Icon name="truck" /></span>New online parcel</button>
        <button className="quick-btn" onClick={() => setModal("stock")}><span className="qi blue"><Icon name="box" /></span>Stock in</button>
        <button className="quick-btn" onClick={() => setModal("pay")}><span className="qi amber"><Icon name="wallet" /></span>Pay supplier</button>
      </div>

      {!d ? <Loading /> : (
        <>
          <div className="stats">
            <Stat label="Sales this month" value={money(d.revenue, cur)} sub={`${d.orders} orders · ${d.items_sold} items`} icon="bag" />
            <Stat label="Net profit" value={money(d.net_profit, cur)} tone={d.net_profit >= 0 ? "pos" : "neg"}
              sub={`Gross ${money(d.gross_profit, cur)} − expenses ${money(d.expenses, cur)}`} icon="check" />
            <Stat label="Pending to suppliers" value={money(d.payable, cur)} tone={d.payable > 0 ? "neg" : ""} sub={`Paid this month ${money(d.paid_to_suppliers, cur)}`} icon="users" />
            <Stat label="Payments to receive" value={money(d.receivable, cur)} tone={d.receivable > 0 ? "warn" : ""} sub="COD / credit not yet received" icon="wallet" />
          </div>
          <div className="stats small">
            <Stat label="Shop sales" value={money(d.shop_revenue, cur)} />
            <Stat label="Online sales" value={money(d.online_revenue, cur)} />
            <Stat label="Stock bought this month" value={money(d.purchases, cur)} />
            <Stat label="Stock value (at cost)" value={money(d.stock_value, cur)} sub={`Sells for ${money(d.retail_value, cur)}`} />
          </div>

          <div className="cols">
            <div className="card">
              <div className="card-head">
                <h3>Recent sales</h3>
                <Link href="/sales" className="link">View all</Link>
              </div>
              {d.recent_sales.length === 0 ? <p className="muted pad">No sales yet. Use “New shop sale” or “New online parcel” above.</p> : (
                <div className="list">
                  {d.recent_sales.map((s) => (
                    <div className="list-row" key={s.id}>
                      <div className={`ch ${s.channel}`}>{s.channel === "online" ? "📦" : "🏪"}</div>
                      <div className="grow">
                        <div className="strong">{s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                        <div className="muted small">{fmtDate(s.date)} · {s.customer || (s.channel === "shop" ? "Walk-in" : "—")}{s.city ? ` · ${s.city}` : ""}</div>
                      </div>
                      <div className="right">
                        <div className="strong">{money(s.bill, cur)}</div>
                        <StatusBadge status={s.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-head"><h3>Online parcels this month</h3><Link href="/sales?channel=online" className="link">Open</Link></div>
                <div className="pills">
                  {["pending", "packed", "shipped", "delivered", "returned", "cancelled"].map((k) => (
                    <div className="pill" key={k}>
                      <span className={`pill-dot ${STATUS[k].tone}`} />
                      <span>{STATUS[k].label}</span>
                      <b>{d.status_counts[k] || 0}</b>
                    </div>
                  ))}
                </div>
                {d.active_orders > 0 && <p className="muted small pad-x">{d.active_orders} parcel(s) still on the way overall.</p>}
              </div>

              <div className="card">
                <div className="card-head"><h3>Pending to suppliers</h3><Link href="/suppliers" className="link">All suppliers</Link></div>
                {d.top_suppliers.length === 0 ? <p className="muted pad">Nothing pending. 🎉</p> : (
                  <div className="list">
                    {d.top_suppliers.map((s) => (
                      <Link href={`/suppliers/${s.id}`} className="list-row hover" key={s.id}>
                        <div className="avatar">{s.name[0]?.toUpperCase()}</div>
                        <div className="grow strong">{s.name}</div>
                        <div className="neg strong">{money(s.balance, cur)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-head"><h3>Low stock</h3><Link href="/products" className="link">Products</Link></div>
                {d.low_stock.length === 0 ? <p className="muted pad">All products have enough stock.</p> : (
                  <div className="list">
                    {d.low_stock.map((p) => (
                      <div className="list-row" key={p.id}>
                        <div className="grow strong">{p.name}</div>
                        <Badge tone={p.stock <= 0 ? "red" : "amber"}>{p.stock <= 0 ? "Out of stock" : `${p.stock} left`}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Last 6 months</h3></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Month</th><th className="num">Orders</th><th className="num">Sales</th><th className="num">Gross profit</th><th className="num">Expenses</th><th className="num">Net profit</th></tr></thead>
                <tbody>
                  {[...d.trend].reverse().map((t) => (
                    <tr key={t.month}>
                      <td className="strong nowrap">{fmtDate(t.month)}</td>
                      <td className="num">{num(t.orders)}</td>
                      <td className="num">{money(t.revenue, cur)}</td>
                      <td className="num">{money(t.profit, cur)}</td>
                      <td className="num">{money(t.expenses, cur)}</td>
                      <td className={`num strong ${t.net >= 0 ? "pos" : "neg"}`}>{money(t.net, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <SaleModal open={modal === "shop" || modal === "online"} defaultChannel={modal === "online" ? "online" : "shop"} onClose={close} onSaved={load} />
      <PurchaseModal open={modal === "stock"} onClose={close} onSaved={load} />
      <PaymentModal open={modal === "pay"} onClose={close} onSaved={load} />
    </>
  );
}
