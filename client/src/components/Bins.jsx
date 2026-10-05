const fmt = (n) => new Intl.NumberFormat("en-IN").format(n);

export default function Bins({ bins }) {
  return (
    <section className="card">
      <h2>Bins</h2>
      <div className="bins">
        {bins.map((b) => (
          <div key={b.code}>
            <b>{b.code}</b>
            <span className="bar">
              <i className={b.utilisation > 0.85 ? "hot" : ""} style={{ width: `${Math.round(b.utilisation * 100)}%` }} />
            </span>
            <span>
              {fmt(b.used)} / {fmt(b.capacity)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
