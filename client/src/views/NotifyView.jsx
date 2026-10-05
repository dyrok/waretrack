import { useState } from "react";
import { post } from "../api.js";
import { ErrorMessage, Field, Notice, clean } from "../components/form.jsx";

// J17: send a push notification (manager only).
export default function NotifyView() {
  const [form, setForm] = useState({ title: "", body: "", topic: "all-staff", token: "" });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await post("/api/notifications/send", clean(form));
      setNotice("Notification queued");
      setError(null);
      setForm({ title: "", body: "", topic: "all-staff", token: "" });
    } catch (err) {
      setNotice("");
      setError(err);
    }
  };

  return (
    <>
      <h2>Send push notification</h2>
      <ErrorMessage error={error} />
      <Notice text={notice} />
      <form className="card" onSubmit={submit}>
        <Field label="Title">
          <input value={form.title} onChange={set("title")} required maxLength={80} />
        </Field>
        <Field label="Body">
          <input value={form.body} onChange={set("body")} required maxLength={240} />
        </Field>
        <p className="hint">Send to a topic (all staff) or to one device token — not both.</p>
        <div className="row">
          <Field label="Topic">
            <input value={form.topic} onChange={set("topic")} maxLength={60} />
          </Field>
          <Field label="Device token (optional)">
            <input value={form.token} onChange={set("token")} />
          </Field>
        </div>
        <button type="submit">Send</button>
      </form>
    </>
  );
}
