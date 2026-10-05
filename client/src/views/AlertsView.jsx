import { useEffect, useState } from "react";
import { api, post, put } from "../api.js";
import { ErrorMessage, Field, Notice } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);

// J10 watch alerts + run check (everyone), J15 resolve (manager).
export default function AlertsView({ user, tick }) {
  const isManager = user.role === "manager";
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("open");
  const [resolving, setResolving] = useState(null); // the alert being resolved
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const res = await api(`/api/alerts?status=${status}`);
      setAlerts(res.data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  };
  useEffect(() => {
    refresh();
  }, [tick, status]);

  const runCheck = async () => {
    try {
      const res = await post("/api/alerts/check");
      setNotice(`Checked ${res.scanned} items: ${res.created} new alert(s), ${res.open} open`);
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  const resolve = async (e) => {
    e.preventDefault();
    try {
      await put(`/api/alerts/${resolving._id ?? resolving.id}/resolve`, { note });
      setNotice("Alert resolved");
      setResolving(null);
      setNote("");
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Low-stock alerts</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      <section className="toolbar">
        <Field label="Show">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">open</option>
            <option value="resolved">resolved</option>
            <option value="all">all</option>
          </select>
        </Field>
        <button type="button" onClick={runCheck}>
          Run check now
        </button>
      </section>

      {resolving ? (
        <form className="card" onSubmit={resolve}>
          <h2>Resolve alert for {resolving.item?.sku}</h2>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
          <div className="row">
            <button type="submit">Resolve</button>
            <button type="button" className="ghost" onClick={() => setResolving(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="card">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">On hand</th>
                <th className="num">Reorder at</th>
                <th>Status</th>
                <th className="name">Note</th>
                {isManager ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a._id ?? a.id}>
                  <td>
                    {a.item?.sku} <small className="muted">{a.item?.name}</small>
                  </td>
                  <td className="num">{fmt(a.onHand)}</td>
                  <td className="num">{fmt(a.threshold)}</td>
                  <td>
                    <span className={`pill ${a.status === "open" ? "hot" : "ok"}`}>{a.status}</span>
                  </td>
                  <td className="name">{a.note || "–"}</td>
                  {isManager ? (
                    <td>
                      {a.status === "open" ? (
                        <button type="button" className="ghost" onClick={() => setResolving(a)}>
                          Resolve
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
