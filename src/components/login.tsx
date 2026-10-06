"use client";
import { useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
export function Login({ mode }: { mode: "demo" | "live" }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function login(data: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        company<span>/</span>os
      </div>
      <section className="login-card">
        <div className="eyebrow">THE COMPANY, IN FOCUS</div>
        <h1>
          A clearer view.
          <br />
          <span>A smarter move.</span>
        </h1>
        <p>
          Real economics. Cash clarity.
          <br />
          The confidence to make your next move.
        </p>
        {mode === "demo" ? (
          <>
            <div className="demo-notice">
              <ShieldCheck size={18} />
              <div>
                <strong>Isolated demo workspace</strong>
                <p>
                  Fictional business data. No connected accounts.
                  <br />
                  Please do not upload real financial documents.
                </p>
              </div>
            </div>
            <button
              className="primary wide"
              disabled={busy}
              onClick={() => login({ demo: true })}
            >
              Enter demo workspace <ArrowUpRight size={18} />
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              login({ email: f.get("email"), password: f.get("password") });
            }}
          >
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary wide" disabled={busy}>
              Sign in <ArrowUpRight size={18} />
            </button>
          </form>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="login-foot">
          PRIVATE WORKSPACE <span>COMPANY OS / V0.1</span>
        </div>
      </section>
      <div className="login-bottom">
        Built for decisions. Grounded in the numbers.
      </div>
    </main>
  );
}
