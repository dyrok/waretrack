import { useEffect, useState } from "react";
import { api, post, put } from "../api.js";
import { ErrorMessage, Field, Notice, clean } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);
const EMPTY = { code: "", zone: "GENERAL", capacity: "1000" };

// Bin list for everyone; J12 add/edit is manager only.
export default function BinsView({ user, tick }) {
  const isManager = user.role === "manager";
  const [bins, setBins] = useState([]);
  const [form, setForm] = useState(null); // null = closed, EMPTY = new, otherwise the bin being edited
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const res = await api("/api/bins");
      setBins(res.data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  };
  useEffect(() => {
    refresh();
  }, [tick]);

  const save = async (e) => {
    e.preventDefault();
    const body = clean({
      code: form.code,
      zone: form.zone,
      capacity: form.capacity,
      active: form._id ?? form.id ? String(!!form.active) : undefined,
    });
    try {
      if (form._id ?? form.id) {
        await put(`/api/bins/${form._id ?? form.id}`, body);
        setNotice("Bin updated");
      } else {
        await post("/api/bins", body);
        setNotice("Bin added");
      }
      setForm(null);
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Bins</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      {isManager ? (
        <section className="toolbar">
          <button
            type="button"
            onClick={() => setForm(form ? null : { ...EMPTY, active: true })}
          >
            {form ? "Close form" : "Add bin"}
          </button>
        </section>
      ) : null}

      {form ? (
        <form className="card" onSubmit={save}>
          <h2>{form._id ?? form.id ? `Edit bin ${form.code}` : "New bin"}</h2>
          <div className="row">
            <Field label="Code">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                maxLength={20}
                disabled={!!(form._id ?? form.id)}
              />
            </Field>
            <Field label="Zone">
              <input
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value.toUpperCase() })}
                maxLength={20}
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </Field>
            {form._id ?? form.id ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>
            ) : null}
          </div>
          <div className="row">
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={() => setForm(null)}>
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
                <th>Code</th>
                <th>Zone</th>
                <th className="num">Used</th>
                <th className="num">Capacity</th>
                <th>Fill</th>
                <th>Status</th>
                {isManager ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {bins.map((b) => (
                <tr key={b.code}>
                  <td>{b.code}</td>
                  <td>{b.zone}</td>
                  <td className="num">{fmt(b.used)}</td>
                  <td className="num">{fmt(b.capacity)}</td>
                  <td>
                    <span className="bar wide">
                      <i
                        className={b.utilisation > 0.85 ? "hot" : ""}
                        style={{ width: `${Math.round(b.utilisation * 100)}%` }}
                      />
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${b.active ? "ok" : ""}`}>{b.active ? "active" : "closed"}</span>
                  </td>
                  {isManager ? (
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setForm({ ...b, capacity: String(b.capacity) })}
                      >
                        Edit
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
