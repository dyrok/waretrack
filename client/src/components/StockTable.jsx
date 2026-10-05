const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);
const statusPill = { "reorder-now": "hot", "reorder-soon": "hot", ok: "ok" };

export default function StockTable({ items, forecast }) {
  const cover = new Map(forecast.map((f) => [f.sku, f]));
  return (
    <div className="card">
      <h2>Stock &amp; forecast</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th className="name">Item</th>
              <th className="num">On hand</th>
              <th className="num">Cover (days)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const f = cover.get(i.sku);
              const low = i.onHand < i.reorderLevel;
              // Below reorder level always wins; otherwise show the forecast verdict.
              const label = low ? "low" : f ? f.status : "ok";
              const cls = low ? "hot" : statusPill[label] || "";
              return (
                <tr key={i.id ?? i.sku}>
                  <td>{i.sku}</td>
                  <td className="name">{i.name}</td>
                  <td className="num">{fmt(i.onHand)}</td>
                  <td className="num">{f && f.daysOfCover !== null ? f.daysOfCover : "–"}</td>
                  <td>
                    <span className={`pill ${cls}`}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
