import { useEffect, useState } from "react";
import { api } from "../api.js";
import Bins from "../components/Bins.jsx";
import LiveFeed from "../components/LiveFeed.jsx";
import StockTable from "../components/StockTable.jsx";
import { ErrorMessage } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);

// J5: glance at the floor. Forecast is a manager report, so staff just
// see the stock table without the cover column.
export default function Dashboard({ user, tick, feed }) {
  const [data, setData] = useState({ total: 0, items: [], bins: [], alerts: [], forecast: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [items, bins, alerts] = await Promise.all([
          api("/api/items?limit=100"),
          api("/api/bins"),
          api("/api/alerts"),
        ]);
        const forecast =
          user.role === "manager" ? (await api("/api/reports/forecast")).items : [];
        setData({ total: items.total, items: items.data, bins: bins.data, alerts: alerts.data, forecast });
        setError(null);
      } catch (err) {
        setError(err);
      }
    })();
  }, [tick, user.role]);

  const units = data.items.reduce((s, i) => s + i.onHand, 0);
  const util = Math.round((data.bins.reduce((s, b) => s + b.utilisation, 0) / (data.bins.length || 1)) * 100);

  return (
    <>
      <ErrorMessage error={error} />
      <section className="kpis">
        <div className="card kpi">
          <b>{data.total}</b>
          <span>items in catalogue</span>
        </div>
        <div className="card kpi">
          <b>{fmt(units)}</b>
          <span>units on hand</span>
        </div>
        <div className="card kpi alert">
          <b>{data.alerts.length}</b>
          <span>open low-stock alerts</span>
        </div>
        <div className="card kpi">
          <b>{util}%</b>
          <span>average bin utilisation</span>
        </div>
      </section>
      <section className="grid2">
        <StockTable items={data.items} forecast={data.forecast} />
        <LiveFeed entries={feed} />
      </section>
      <Bins bins={data.bins} />
    </>
  );
}
