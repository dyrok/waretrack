import { useState } from "react";
import { register } from "../api.js";
import { ErrorMessage, Field, Notice, clean } from "../components/form.jsx";

// J4: create a teammate (manager only). The manager's token travels with the
// request, so asking for a manager role is allowed — staff cannot reach this screen.
export default function TeamView() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = await register(clean(form));
      setNotice(`Created ${body.user.name} (${body.user.role})`);
      setError(null);
      setForm({ name: "", email: "", password: "", role: "staff" });
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Team</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      <form className="card" onSubmit={submit}>
        <h2>Create account</h2>
        <div className="row">
          <Field label="Name">
            <input value={form.name} onChange={set("name")} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set("email")} required />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={set("role")}>
              <option value="staff">staff</option>
              <option value="manager">manager</option>
            </select>
          </Field>
        </div>
        <button type="submit">Create account</button>
      </form>
    </>
  );
}
