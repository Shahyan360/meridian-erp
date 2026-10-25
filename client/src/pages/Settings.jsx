import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../lib/context";
import { request } from "../services/api";
import { EmptyState, ErrorState, Icon, Skeleton } from "../components/ui";
import { ResourceView } from "./ResourcePage";

export default function Settings() {
  const { user, toast, theme, toggleTheme, refreshConfig } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const active = ["users", "audit"].includes(params.get("tab"))
    ? params.get("tab")
    : "settings";
  const [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (user.role !== "ADMIN") return;
    let alive = true;
    request("/settings")
      .then((s) => {
        if (alive) {
          const { id: _id, ...data } = s;
          setForm(data);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [user.role, version]);
  if (user.role !== "ADMIN")
    return (
      <EmptyState
        title="A different level of access"
        description="Workspace settings are managed by your administrator."
        icon="ShieldCheck"
      />
    );
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await request("/settings", { method: "PUT", body: form });
      await refreshConfig();
      window.dispatchEvent(new Event("app-data-changed"));
      toast("Your workspace settings are saved.");
    } catch (reason) {
      setError(
        reason.fields ? Object.values(reason.fields).join(" ") : reason.message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="module-tabs">
        {[
          ["settings", "Workspace"],
          ["users", "Team & access"],
          ["audit", "Activity log"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={active === key ? "active" : ""}
            onClick={() => setParams({ tab: key })}
          >
            {label}
          </button>
        ))}
      </div>
      {active !== "settings" ? (
        <ResourceView key={active} resource={active} />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">MAKE YOURSELF AT HOME</div>
              <h1>
                Your workspace<span className="accent">.</span>
              </h1>
              <p>
                A few thoughtful settings. A workspace that feels like yours.
              </p>
            </div>
          </div>
          {error && (
            <ErrorState
              message={error}
              onRetry={() => setVersion((n) => n + 1)}
            />
          )}
          {!form ? (
            <Skeleton rows={6} />
          ) : (
            <div className="settings-layout">
              <form className="card record-form" onSubmit={save}>
                <div className="card-heading">
                  <div>
                    <h2>Business details</h2>
                    <p>Used throughout your workspace and reports.</p>
                  </div>
                  <span className="kpi-icon tone-0">
                    <Icon name="Building2" />
                  </span>
                </div>
                <div className="form-grid">
                  <label>
                    Workspace name
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Business email
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Currency
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm({ ...form, currency: e.target.value })
                      }
                    >
                      {["PKR", "USD", "EUR", "GBP", "AED"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    <small className="field-hint">
                      Display currency only; existing amounts are not converted.
                    </small>
                  </label>
                  <label>
                    Business timezone
                    <input
                      required
                      value={form.timezone}
                      onChange={(e) =>
                        setForm({ ...form, timezone: e.target.value })
                      }
                      placeholder="Asia/Karachi"
                    />
                    <small className="field-hint">
                      Use an IANA name, such as Asia/Karachi.
                    </small>
                  </label>
                  <label className="full-width">
                    Business address
                    <textarea
                      maxLength={500}
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="btn primary" disabled={busy}>
                    <Icon name="Check" size={16} />
                    {busy ? "Saving…" : "Save workspace"}
                  </button>
                </div>
              </form>
              <div className="settings-side">
                <section className="card">
                  <span className="empty-icon">
                    <Icon name={theme === "dark" ? "Moon" : "Sun"} size={24} />
                  </span>
                  <h2>Your preferred perspective</h2>
                  <p>Light or dark. Same clarity, your choice.</p>
                  <button className="btn" onClick={toggleTheme}>
                    Switch to {theme === "dark" ? "light" : "dark"} mode
                  </button>
                </section>
                <section className="card security-note">
                  <Icon name="ShieldCheck" size={25} />
                  <h2>Good boundaries. Better teamwork.</h2>
                  <p>
                    Administrators manage everything. Managers run operations
                    and finance. Employees can view daily operations.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => setParams({ tab: "users" })}
                  >
                    Manage team access <Icon name="ArrowUpRight" size={15} />
                  </button>
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
