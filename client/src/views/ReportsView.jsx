import { useEffect, useState } from "react";
import { api } from "../api.js";
import { ErrorMessage, Field } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// J16: reports — turnover, waste and forecast. Manager only (the nav hides this from staff).
export default function ReportsView({ tick }) {
  const [months, setMonths] = useState("6");
  const [forecast, setForecast] = useState({ days: "30", leadTimeDays: "7", coverDays: "14" });
  const [turnover, setTurnover] = useState(null);
  const [waste, setWaste] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const [t, w, f] = await Promise.all([
        api(`/api/reports/turnover?months=${months}`),
        api(`/api/reports/waste?months=${months}`),
        api(
          `/api/reports/forecast?days=${forecast.days}&leadTimeDays=${forecast.leadTimeDays}&coverDays=${forecast.coverDays}`,
        ),
      ]);
      setTurnover(t);
      setWaste(w);
      setPrediction(f);
      setError(null);
    } catch (err) {
      setError(err);
    }
  };
  useEffect(() => {
    refresh();
  }, [tick]);

  return (
    <>
      <h2>Reports</h2>
      <ErrorMessage error={error} />
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          refresh();
        }}
      >
        <Field label="History (months)">
          <input type="number" min="1" max="24" value={months} onChange={(e) => setMonths(e.target.value)} />
        </Field>
        <Field label="Forecast days">
          <input
            type="number"
            min="7"
            max="365"
            value={forecast.days}
            onChange={(e) => setForecast({ ...forecast, days: e.target.value })}
          />
        </Field>
        <Field label="Lead time (days)">
          <input
            type="number"
            min="1"
            max="90"
            value={forecast.leadTimeDays}
            onChange={(e) => setForecast({ ...forecast, leadTimeDays: e.target.value })}
          />
        </Field>
        <Field label="Cover (days)">
          <input
            type="number"
            min="1"
            max="90"
            value={forecast.coverDays}
            onChange={(e) => setForecast({ ...forecast, coverDays: e.target.value })}
          />
        </Field>
        <button type="submit">Run reports</button>
      </form>

      <section className="card">
        <h2>Turnover per item</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th className="name">Item</th>
                <th className="num">Shipped</th>
                <th className="num">Opening</th>
                <th className="num">Closing</th>
                <th className="num">Turnover</th>
              </tr>
            </thead>
            <tbody>
              {(turnover?.items || []).map((r) => (
                <tr key={r.sku}>
                  <td>{r.sku}</td>
                  <td className="name">{r.name}</td>
                  <td className="num">{fmt(r.unitsShipped)}</td>
                  <td className="num">{fmt(r.openingUnits)}</td>
                  <td className="num">{fmt(r.closingUnits)}</td>
                  <td className="num">{r.turnover ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>Monthly shipments</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Units shipped</th>
                <th className="num">Cost of goods</th>
                <th className="num">Shipments</th>
              </tr>
            </thead>
            <tbody>
              {(turnover?.monthly || []).map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td className="num">{fmt(m.unitsShipped)}</td>
                  <td className="num">{money(m.costOfGoods)}</td>
                  <td className="num">{fmt(m.shipments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Waste</h2>
        {waste ? (
          <p className="hint">
            Written off: {money(waste.totals.writtenOffCost)} · Expired still on hand:{" "}
            {money(waste.totals.expiredOnHandCost)}
          </p>
        ) : null}
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th className="num">Units</th>
                <th className="num">Cost</th>
                <th className="num">Events</th>
              </tr>
            </thead>
            <tbody>
              {(waste?.writtenOff || []).map((w) => (
                <tr key={w.reason}>
                  <td>{w.reason}</td>
                  <td className="num">{fmt(w.units)}</td>
                  <td className="num">{money(w.cost)}</td>
                  <td className="num">{fmt(w.events)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>Expired lots still on hand</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th className="name">Item</th>
                <th>Bin</th>
                <th className="num">Units</th>
                <th>Expired</th>
              </tr>
            </thead>
            <tbody>
              {(waste?.expiredOnHand || []).map((w) => (
                <tr key={w.stockId}>
                  <td>{w.sku}</td>
                  <td className="name">{w.name}</td>
                  <td>{w.bin}</td>
                  <td className="num">{fmt(w.units)}</td>
                  <td>{new Date(w.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Forecast &amp; reorder suggestions</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th className="name">Item</th>
                <th className="num">On hand</th>
                <th className="num">Cover (days)</th>
                <th className="num">Reorder point</th>
                <th className="num">Suggested order</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(prediction?.items || []).map((r) => (
                <tr key={r.sku}>
                  <td>{r.sku}</td>
                  <td className="name">{r.name}</td>
                  <td className="num">{fmt(r.onHand)}</td>
                  <td className="num">{r.daysOfCover ?? "–"}</td>
                  <td className="num">{fmt(r.reorderPoint)}</td>
                  <td className="num">{fmt(r.suggestedOrder)}</td>
                  <td>
                    <span className={`pill ${r.status === "ok" || r.status === "no-demand" ? "ok" : "hot"}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
