export default function LiveFeed({ entries }) {
  return (
    <div className="card">
      <h2>Live feed</h2>
      <ul className="feed">
        {entries.length === 0 ? <li>Sign in to connect the socket.</li> : null}
        {entries.map((e) => (
          <li key={e.key}>
            {e.time} <b>{e.event}</b> {JSON.stringify(e.payload)}
          </li>
        ))}
      </ul>
    </div>
  );
}
