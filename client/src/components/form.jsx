export function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {error.message}
      {(error.details || []).map((d) => (
        <small key={d}>{d}</small>
      ))}
    </p>
  );
}

export function Notice({ text }) {
  if (!text) return null;
  return (
    <p className="notice" role="status">
      {text}
    </p>
  );
}

export function Field({ label, children }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

// Drop empty strings so optional fields are simply not sent
// (the API validates e.g. expiresAt only when it is present).
export const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== null && v !== undefined));
