import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const demos = [
  { email: "accountant@complybd.com", role: "Accountant", name: "ফারহানা রহমান" },
  { email: "owner@complybd.com", role: "SME owner", name: "রাকিব হাসান" },
  { email: "reviewer@complybd.com", role: "Reviewer", name: "নাবিলা চৌধুরী" },
];

function homeFor(role) {
  if (role === "owner") return "/owner";
  if (role === "reviewer") return "/review";
  return "/dashboard";
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("accountant@complybd.com");
  const [password, setPassword] = useState("demo123");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      push("সাইন ইন সফল");
      navigate(homeFor(u.role));
    } catch (err) {
      push(err.response?.data?.message || "Login failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,#dcebe3,transparent),radial-gradient(900px_500px_at_100%_0%,#f3e7c9,transparent)] px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">Bangladesh SME compliance</p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-ink">ComplyBD</h1>
          <p className="bn mt-4 max-w-md text-lg text-ink/70">
            এনবিআর/মূসক পরিপত্র থেকে বাধ্যবাধকতা তুলে, উৎস পাঠের সাথে মিলিয়ে, হিসাবরক্ষক ও মালিককে সরল বাংলায় সতর্কতা পাঠায়।
          </p>
          <ul className="mt-8 space-y-2 text-sm text-ink/65">
            <li>— Deterministic grounding against the circular text</li>
            <li>— Low-confidence items go to human review</li>
            <li>— Append-only hashed audit trail with simulated chain anchors</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-card">
          <h2 className="font-display text-2xl">Demo sign in</h2>
          <p className="mt-1 text-sm text-ink/50">Password for all seeded accounts: <code>demo123</code></p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm">
              Email
              <input
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 outline-none focus:border-forest-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 outline-none focus:border-forest-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-forest-800 py-3 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Enter workspace"}
            </button>
          </form>
          <div className="mt-6 space-y-2">
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("demo123");
                }}
                className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-clay/50 px-3 py-2 text-left text-sm hover:border-forest-200"
              >
                <span>
                  <span className="bn font-medium">{d.name}</span>
                  <span className="ml-2 text-ink/45">{d.role}</span>
                </span>
                <span className="text-xs text-forest-700">Use</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
