"use client";
import { useEffect, useState } from "react";
import type { User } from "@/lib/auth";
import { api, Badge } from "./workspace-ui";
type Account = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  is_demo: boolean;
};
export function AccessSettings({ user }: { user: User }) {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    if (user.role === "OWNER") {
      try {
        setAccounts((await api("/api/users")).users);
      } catch (e) {
        setError(e instanceof Error ? e.message : "User access load failed");
      }
    }
  }
  useEffect(() => {
    if (user.role === "OWNER")
      api("/api/users")
        .then((r) => setAccounts(r.users))
        .catch((e) => setError(e.message));
  }, [user.role]);
  return (
    <section className="panel spaced">
      <div className="panel-heading">
        <h2>Workspace access</h2>
        <Badge>Server-enforced roles</Badge>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && <div className="success-banner">{message}</div>}
      {user.role === "OWNER" && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      <small>{a.email}</small>
                    </td>
                    <td>
                      {a.role.replaceAll("_", " ")}
                      {a.is_demo && <Badge>DEMO</Badge>}
                    </td>
                    <td>{a.active ? "Active" : "Disabled"}</td>
                    <td>
                      {a.id !== user.id && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            try {
                              await api("/api/users", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: a.id,
                                  active: !a.active,
                                }),
                              });
                              await load();
                              setMessage(
                                "Access updated. Existing sessions revoked.",
                              );
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Access change failed",
                              );
                            }
                          }}
                        >
                          {a.active ? "Disable & revoke" : "Enable"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="finance-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                values = Object.fromEntries(new FormData(form));
              try {
                await api("/api/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                });
                form.reset();
                await load();
                setMessage(
                  "Account created. Share its initial password through your approved private channel.",
                );
                setError("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Account create failed",
                );
              }
            }}
          >
            <h3>Add a team account</h3>
            <div className="form-grid">
              <label>
                Name
                <input required name="name" maxLength={120} />
              </label>
              <label>
                Email
                <input required name="email" type="email" />
              </label>
              <label>
                Initial password
                <input
                  required
                  name="password"
                  type="password"
                  minLength={14}
                  maxLength={256}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Role
                <select name="role">
                  <option value="OPERATIONS_MANAGER">Operations Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </label>
            </div>
            <button className="primary">Create account</button>
          </form>
        </>
      )}
      <form
        className="finance-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const values = Object.fromEntries(new FormData(e.currentTarget));
            await api("/api/password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
            });
            location.reload();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Password change failed");
          }
        }}
      >
        <h3>Change your password</h3>
        <p className="form-intro">
          All sessions are revoked after a successful change. Demo entry
          accounts do not have a password.
        </p>
        <div className="form-grid">
          <label>
            Current password
            <input
              required
              name="current"
              type="password"
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              required
              name="password"
              type="password"
              minLength={14}
              maxLength={256}
              autoComplete="new-password"
            />
          </label>
        </div>
        <button className="secondary">Change password & sign out</button>
      </form>
    </section>
  );
}
