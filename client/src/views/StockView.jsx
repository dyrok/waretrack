import { useEffect, useState } from "react";
import { api, post } from "../api.js";
import { ErrorMessage, Field, Notice, clean } from "../components/form.jsx";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);

// J6 receive, J7 ship (everyone), J13 transfer (manager).
// The ledger underneath is what happened last.
export default function StockView({ user, tick }) {
  const isManager = user.role === "manager";
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    try {
      const [itemList, binList, tx] = await Promise.all([
        api("/api/items?limit=100"),
        api("/api/bins"),
        api("/api/transactions?limit=15"),
      ]);
      setItems(itemList.data);
      setBins(binList.data.filter((b) => b.active));
      setLedger(tx.data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  };
  useEffect(() => {
    refresh();
  }, [tick]);

  const run = async (path, body, message) => {
    try {
      await post(path, clean(body));
      setNotice(message);
      setError(null);
      refresh();
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Stock movements</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      <section className="forms">
        <ReceiveForm items={items} bins={bins} onRun={run} />
        <ShipForm items={items} bins={bins} onRun={run} />
        {isManager ? <TransferForm items={items} bins={bins} onRun={run} /> : null}
      </section>
      <section className="card">
        <h2>Ledger (newest first)</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th className="name">Item</th>
                <th className="num">Qty</th>
                <th>From</th>
                <th>To</th>
                <th className="name">By</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((t) => (
                <tr key={t._id ?? t.id}>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={`pill ${t.type === "SHIP" ? "hot" : t.type === "RECEIVE" ? "ok" : ""}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="name">{t.item?.sku}</td>
                  <td className="num">{fmt(t.quantity)}</td>
                  <td>{t.fromBin?.code || "–"}</td>
                  <td>{t.toBin?.code || "–"}</td>
                  <td className="name">{t.user?.name || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ItemSelect({ items, value, onChange }) {
  return (
    <Field label="Item">
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">choose…</option>
        {items.map((i) => (
          <option key={i._id ?? i.id} value={i._id ?? i.id}>
            {i.sku} — {i.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function BinSelect({ bins, label, value, onChange, optional }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{optional ? "any bin" : "choose…"}</option>
        {bins.map((b) => (
          <option key={b.code} value={b.code}>
            {b.code} ({fmt(b.free)} free)
          </option>
        ))}
      </select>
    </Field>
  );
}

function ReceiveForm({ items, bins, onRun }) {
  const [f, setF] = useState({ itemId: "", bin: "", quantity: "", expiresAt: "", reference: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const perishable = items.find((i) => (i._id ?? i.id) === f.itemId)?.perishable;
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onRun("/api/transactions/receive", f, "Stock received");
      }}
    >
      <h2>Receive into bin</h2>
      <ItemSelect items={items} value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} />
      <BinSelect bins={bins} label="Bin" value={f.bin} onChange={(v) => setF({ ...f, bin: v })} />
      <Field label="Quantity">
        <input type="number" min="1" value={f.quantity} onChange={set("quantity")} required />
      </Field>
      <Field label={perishable ? "Best before (required — perishable)" : "Best before (optional)"}>
        <input type="date" value={f.expiresAt} onChange={set("expiresAt")} required={perishable} />
      </Field>
      <Field label="Reference (optional)">
        <input value={f.reference} onChange={set("reference")} maxLength={60} />
      </Field>
      <button type="submit">Receive</button>
    </form>
  );
}

function ShipForm({ items, bins, onRun }) {
  const [f, setF] = useState({ itemId: "", quantity: "", bin: "", reference: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onRun("/api/transactions/ship", f, "Stock shipped (oldest expiry first)");
      }}
    >
      <h2>Ship out</h2>
      <ItemSelect items={items} value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} />
      <Field label="Quantity">
        <input type="number" min="1" value={f.quantity} onChange={set("quantity")} required />
      </Field>
      <BinSelect bins={bins} label="Bin" value={f.bin} onChange={(v) => setF({ ...f, bin: v })} optional />
      <Field label="Reference (optional)">
        <input value={f.reference} onChange={set("reference")} maxLength={60} />
      </Field>
      <button type="submit">Ship</button>
    </form>
  );
}

function TransferForm({ items, bins, onRun }) {
  const [f, setF] = useState({ itemId: "", fromBin: "", toBin: "", quantity: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onRun("/api/transactions/transfer", f, "Stock transferred");
      }}
    >
      <h2>Transfer between bins</h2>
      <ItemSelect items={items} value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} />
      <BinSelect bins={bins} label="From bin" value={f.fromBin} onChange={(v) => setF({ ...f, fromBin: v })} />
      <BinSelect bins={bins} label="To bin" value={f.toBin} onChange={(v) => setF({ ...f, toBin: v })} />
      <Field label="Quantity">
        <input type="number" min="1" value={f.quantity} onChange={set("quantity")} required />
      </Field>
      <button type="submit">Transfer</button>
    </form>
  );
}
