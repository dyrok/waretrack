import { useEffect, useState } from "react";
import { api, put } from "../api.js";
import { ErrorMessage, Field, Notice, clean } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);
const REASONS = ["count", "expired", "damaged", "lost", "found"];

// Lot list for everyone; J14 stock count / adjustment is manager only.
export default function InventoryView({ user, tick }) {
  const isManager = user.role === "manager";
  const [lots, setLots] = useState([]);
  const [filter, setFilter] = useState({ bin: "", expiringWithinDays: "" });
  const [adjust, setAdjust] = useState(null); // the lot being counted
  const [form, setForm] = useState({ quantity: "", reason: "count" });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const qs = new URLSearchParams(clean(filter)).toString();
      const res = await api(`/api/inventory${qs ? `?${qs}` : ""}`);
      setLots(res.data);
      setError(null);
    } catch (err) {
      setLots([]);
      setError(err);
    }
  };
  useEffect(() => {
    refresh();
  }, [tick]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await put(`/api/inventory/${adjust._id ?? adjust.id}`, clean(form));
      setNotice("Lot adjusted — the difference is in the ledger");
      setAdjust(null);
      setForm({ quantity: "", reason: "count" });
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Inventory (lots on hand)</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          refresh();
        }}
      >
        <Field label="Bin">
          <input
            value={filter.bin}
            onChange={(e) => setFilter({ ...filter, bin: e.target.value })}
            placeholder="e.g. A1"
            maxLength={20}
          />
        </Field>
        <Field label="Expiring within days">
          <input
            type="number"
            min="0"
            max="365"
            value={filter.expiringWithinDays}
            onChange={(e) => setFilter({ ...filter, expiringWithinDays: e.target.value })}
          />
        </Field>
        <button type="submit">Filter</button>
      </form>

      {adjust ? (
        <form className="card" onSubmit={save}>
          <h2>
            Count {adjust.item?.sku} in bin {adjust.bin?.code}
          </h2>
          <p className="hint">
            Book quantity is {fmt(adjust.quantity)}. Enter what you actually counted — not the difference.
          </p>
          <div className="row">
            <Field label="Counted quantity">
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </Field>
            <Field label="Reason">
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit">Save count</button>
            <button type="button" className="ghost" onClick={() => setAdjust(null)}>
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
                <th>SKU</th>
                <th className="name">Item</th>
                <th>Bin</th>
                <th className="num">Quantity</th>
                <th>Best before</th>
                {isManager ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot._id ?? lot.id}>
                  <td>{lot.item?.sku}</td>
                  <td className="name">{lot.item?.name}</td>
                  <td>{lot.bin?.code}</td>
                  <td className="num">{fmt(lot.quantity)}</td>
                  <td>
                    {lot.expiresAt ? (
                      <span className={`pill ${new Date(lot.expiresAt) < new Date() ? "hot" : ""}`}>
                        {new Date(lot.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      "–"
                    )}
                  </td>
                  {isManager ? (
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setAdjust(lot);
                          setForm({ quantity: String(lot.quantity), reason: "count" });
                        }}
                      >
                        Adjust
                      </button>
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
