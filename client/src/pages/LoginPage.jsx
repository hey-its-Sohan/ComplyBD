import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { homeFor } from "../components/RequireRole.jsx";
import api from "../api";

/**
 * Sign in.
 *
 * The three role buttons log in directly rather than filling the form, because
 * during a five-minute demo the presenter switches roles repeatedly and every
 * extra click is time spent not showing the product.
 */

const DEMO_ACCOUNTS = [
  {
    role: "accountant",
    label: "Login as Accountant",
    email: "accountant@complybd.com",
    name: "ফারহানা রহমান",
    blurb: "Multi-client dashboard, review queue, audit trail",
  },
  {
    role: "reviewer",
    label: "Login as Reviewer",
    email: "reviewer@complybd.com",
    name: "নাবিলা চৌধুরী",
    blurb: "Approves or rejects ungrounded extractions",
  },
  {
    role: "owner",
    label: "Login as SME Owner",
    email: "owner@complybd.com",
    name: "রাকিব হাসান",
    blurb: "Plain-Bangla alerts for their own shops",
  },
];

const PASSWORD = "demo123";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("accountant@complybd.com");
  const [password, setPassword] = useState(PASSWORD);
  const [busy, setBusy] = useState("");
  const [resetting, setResetting] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const signIn = async (withEmail, withPassword, key = "form") => {
    setBusy(key);
    try {
      const u = await login(withEmail, withPassword);
      push(`Signed in as ${u.name}`);
      navigate(homeFor(u.role));
    } catch (err) {
      push(
        err.response?.data?.message ||
          "Sign in failed. If the database is empty, use Reset demo data below.",
        "error"
      );
    } finally {
      setBusy("");
    }
  };

  const resetDemo = async () => {
    setResetting(true);
    try {
      const res = await api.post("/demo/reset");
      const c = res.data.counts;
      push(
        c
          ? `Demo data rebuilt — ${c.businesses} clients, ${c.circulars} circulars, ${c.alerts} alerts`
          : "Demo data rebuilt"
      );
    } catch (err) {
      push(err.response?.data?.message || "Reset failed", "error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,#dcebe3,transparent),radial-gradient(900px_500px_at_100%_0%,#f3e7c9,transparent)] px-4 py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">
            Bangladesh SME compliance
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">ComplyBD</h1>
          <p className="mt-3 text-lg text-ink/70">Bangla Regulatory Intelligence.</p>
          <p className="bn mt-4 max-w-md leading-8 text-ink/65">
            এনবিআর/মূসক পরিপত্র থেকে বাধ্যবাধকতা তুলে, উৎস পাঠের সাথে মিলিয়ে, হিসাবরক্ষক ও মালিককে
            সরল বাংলায় সতর্কতা পাঠায়।
          </p>

          <ol className="mt-8 space-y-2 text-sm text-ink/65">
            {[
              "AI extracts obligations from the circular",
              "Every field is checked against the source text",
              "Uncertain results go to human review",
              "Verified changes reach matching businesses",
              "Actions are hashed into an append-only audit trail",
            ].map((line, i) => (
              <li key={line} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-800 text-[11px] font-semibold tabular-nums text-white">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-md text-xs leading-5 text-ink/45">
            Informational compliance tool only. This system does not provide legal or tax advice.
            Please consult a licensed accountant or lawyer for high-stakes decisions.
          </p>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl text-ink">Demo sign in</h2>
          <p className="mt-1 text-sm text-ink/50">
            One click each. Password for all seeded accounts: <code>{PASSWORD}</code>
          </p>

          <div className="mt-5 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.role}
                onClick={() => signIn(account.email, PASSWORD, account.role)}
                disabled={Boolean(busy)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 text-left transition-colors hover:border-forest-300 hover:bg-clay/50 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {busy === account.role ? "Signing in…" : account.label}
                  </span>
                  <span className="bn mt-0.5 block truncate text-xs text-ink/45">
                    {account.name} · {account.blurb}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-ink/30">
                  →
                </span>
              </button>
            ))}
          </div>

          <details className="mt-5 border-t border-black/5 pt-4">
            <summary className="cursor-pointer text-sm text-ink/55">Sign in manually</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                signIn(email, password);
              }}
              className="mt-4 space-y-3"
            >
              <label className="block text-sm">
                Email
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 outline-none focus:border-forest-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="block text-sm">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 outline-none focus:border-forest-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="w-full rounded-xl bg-forest-800 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
              >
                {busy === "form" ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </details>

          <div className="mt-5 border-t border-black/5 pt-4">
            <button
              onClick={resetDemo}
              disabled={resetting}
              className="text-sm text-forest-700 underline underline-offset-2 hover:text-forest-800 disabled:opacity-50"
            >
              {resetting ? "Rebuilding demo data…" : "Reset demo data"}
            </button>
            <p className="mt-1 text-xs leading-5 text-ink/40">
              Rebuilds every account, client, circular, alert and audit record. Use this before a
              demo, or if a run left the data in an odd state.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
