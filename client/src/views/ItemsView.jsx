import { useEffect, useState } from "react";
import { api, del, post, put } from "../api.js";
import { ErrorMessage, Field, Notice, clean } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);
const EMPTY = { sku: "", name: "", barcode: "", unit: "unit", reorderLevel: "10", unitCost: "0", perishable: false };

// J8 search and J9 add for everyone, J11 edit/delete for managers.
export default function ItemsView({ user, tick }) {
  const isManager = user.role === "manager";
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // null = closed, otherwise the item being edited (EMPTY = new)
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const res = query
        ? await api(`/api/items/search?${numeric(query) ? "barcode" : "q"}=${encodeURIComponent(query)}`)
        : await api("/api/items?limit=100");
      setItems(res.data);
      setError(null);
    } catch (err) {
      setItems([]);
      setError(err);
    }
  };
  useEffect(() => {
    refresh();
  }, [tick]);

  const save = async (e) => {
    e.preventDefault();
    const body = clean({ ...form, perishable: form.perishable ? "true" : "false" });
    try {
      if (form._id ?? form.id) {
        await put(`/api/items/${form._id ?? form.id}`, body);
        setNotice("Item updated");
      } else {
        await post("/api/items", body);
        setNotice("Item added to the catalogue");
      }
      setForm(null);
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  const remove = async (item) => {
    if (!confirm(`Delete ${item.sku}? Only possible when it has no stock.`)) return;
    try {
      await del(`/api/items/${item._id ?? item.id}`);
      setNotice("Item deleted");
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Items</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      <section className="toolbar">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            refresh();
          }}
        >
          <input
            placeholder="barcode (exact) or name / SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>
          {query ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setQuery("");
                setTimeout(refresh, 0);
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
        <button type="button" onClick={() => setForm({ ...EMPTY })}>
          Add item
        </button>
      </section>

      {form ? (
        <form className="card" onSubmit={save}>
          <h2>{form._id ?? form.id ? `Edit ${form.sku}` : "New item"}</h2>
          <div className="grid3">
            <Field label="SKU">
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required maxLength={40} />
            </Field>
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="Barcode">
              <input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                required
                pattern="\d{4,14}"
                title="4 to 14 digits"
              />
            </Field>
            <Field label="Unit">
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={20} />
            </Field>
            <Field label="Reorder level">
              <input
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              />
            </Field>
            <Field label="Unit cost">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
            </Field>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.perishable}
              onChange={(e) => setForm({ ...form, perishable: e.target.checked })}
            />
            Perishable (needs a best-before date when received)
          </label>
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
                <th>SKU</th>
                <th className="name">Name</th>
                <th>Barcode</th>
                <th className="num">On hand</th>
                <th className="num">Reorder at</th>
                <th className="num">Unit cost</th>
                <th>Status</th>
                {isManager ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i._id ?? i.id}>
                  <td>{i.sku}</td>
                  <td className="name">{i.name}</td>
                  <td>{i.barcode}</td>
                  <td className="num">{i.onHand === undefined ? "–" : fmt(i.onHand)}</td>
                  <td className="num">{fmt(i.reorderLevel)}</td>
                  <td className="num">{fmt(i.unitCost)}</td>
                  <td>
                    <span className={`pill ${i.perishable ? "hot" : ""}`}>{i.perishable ? "perishable" : "standard"}</span>
                  </td>
                  {isManager ? (
                    <td>
                      <div className="row">
                        <button type="button" className="ghost" onClick={() => setForm({ ...i, perishable: !!i.perishable })}>
                          Edit
                        </button>
                        <button type="button" className="ghost" onClick={() => remove(i)}>
                          Delete
                        </button>
                      </div>
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

const numeric = (q) => /^\d{4,14}$/.test(q.trim());
