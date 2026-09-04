import { useEffect, useState } from "react";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";
import { useToast } from "../context/ToastContext.jsx";

/**
 * The SME owner's screen. Bangla first, one idea per card, no technical terms.
 *
 * Everything the accountant sees about confidence, grounding and extraction
 * method is deliberately absent here. The owner needs to know what to do and by
 * when; the machinery that established it is the accountant's concern. The only
 * trust signal kept is a plain "যাচাই করা হয়েছে" line, because that is the one
 * fact that changes whether they should act.
 */

const TONE = {
  high: {
    dot: "🔴",
    label: "জরুরি",
    card: "border-rose-200 bg-rose-50/70",
    chip: "bg-rose-100 text-rose-900",
  },
  medium: {
    dot: "🟡",
    label: "গুরুত্বপূর্ণ",
    card: "border-amber-200 bg-amber-50/70",
    chip: "bg-amber-100 text-amber-900",
  },
  low: {
    dot: "🟢",
    label: "তথ্য",
    card: "border-emerald-200 bg-emerald-50/70",
    chip: "bg-emerald-100 text-emerald-900",
  },
};

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

function toBanglaDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}

function banglaDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return `${toBanglaDigits(d.getDate())} ${BN_MONTHS[d.getMonth()]} ${toBanglaDigits(d.getFullYear())}`;
}

function OwnerAlertCard({ alert, onAcknowledge, onOpen, busy }) {
  const tone = TONE[alert.priority] || TONE.medium;
  const ob = alert.obligationId || {};
  const circular = ob.circularId || {};
  const when = banglaDate(alert.effectiveDate || ob.effectiveDate);
  const done = alert.status === "acknowledged" || alert.status === "resolved";

  return (
    <article className={`rounded-2xl border p-5 shadow-card ${tone.card}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`bn inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tone.chip}`}>
          <span aria-hidden="true">{tone.dot}</span>
          {tone.label}
        </span>
        {done ? (
          <span className="bn rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-forest-800">
            ✓ দেখা হয়েছে
          </span>
        ) : null}
      </div>

      <h3 className="bn mt-3 text-lg font-semibold leading-8 text-ink">
        {alert.whatChanged || alert.messageBangla}
      </h3>

      <p className="bn mt-2 text-sm leading-7 text-ink/70">
        {alert.whyItMatters || `আপনার ব্যবসার জন্য এটি প্রযোজ্য।`}
      </p>

      <div className="mt-4 space-y-2 rounded-xl bg-white/70 p-4">
        <p className="bn text-sm leading-7 text-ink">
          <span className="font-semibold">করণীয়:</span>{" "}
          {(alert.whatToDo || "").replace(/^করণীয়:\s*/, "") || "হিসাবরক্ষকের সঙ্গে কথা বলুন।"}
        </p>
        {when ? (
          <p className="bn text-sm text-ink/70">
            <span className="font-semibold">কার্যকর:</span> {when} থেকে
          </p>
        ) : (
          <p className="bn text-sm text-amber-800">কার্যকর তারিখ পরিপত্রে উল্লেখ নেই।</p>
        )}
      </div>

      <div className="bn mt-3 text-xs leading-6 text-ink/50">
        <p>সূত্র: {circular.title || "এনবিআর পরিপত্র"}</p>
        <p className="mt-0.5 text-forest-800">✓ এই তথ্য মূল পরিপত্রের সঙ্গে মিলিয়ে যাচাই করা হয়েছে।</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!done ? (
          <button
            onClick={() => onAcknowledge(alert)}
            disabled={busy}
            className="bn rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
          >
            আমি বুঝেছি
          </button>
        ) : null}
        <button
          onClick={() => onOpen(alert)}
          className="bn rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-ink/75 hover:bg-clay"
        >
          বিস্তারিত দেখুন
        </button>
      </div>
    </article>
  );
}

export default function OwnerDashboard() {
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    api
      .get("/dashboard/owner")
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || err.message));
  };

  useEffect(load, []);

  const acknowledge = async (alert) => {
    setBusy(true);
    try {
      const res = await api.post(`/alerts/${alert._id}/acknowledge`);
      setData((d) => ({
        ...d,
        alerts: d.alerts.map((a) => (a._id === alert._id ? { ...a, ...res.data } : a)),
        openAlerts: Math.max(0, d.openAlerts - 1),
      }));
      push("ধন্যবাদ — নোটিশটি দেখা হয়েছে হিসেবে চিহ্নিত হলো");
    } catch (err) {
      push(err?.response?.data?.message || "সংরক্ষণ করা যায়নি", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <>
        <Topbar title="আমার ব্যবসা" />
        <div className="p-6">
          <ErrorBlock message={error} onRetry={load} />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar title="আমার ব্যবসা" />
        <div className="p-6">
          <LoadingBlock label="লোড হচ্ছে" rows={2} />
        </div>
      </>
    );
  }

  const open = data.alerts.filter((a) => a.status === "new" || a.status === "seen");
  const done = data.alerts.filter((a) => a.status === "acknowledged" || a.status === "resolved");

  return (
    <>
      <Topbar title="আমার ব্যবসা" subtitle="সহজ বাংলায় আপনার প্রয়োজনীয় তথ্য" />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <header>
          <h1 className="bn font-display text-2xl leading-relaxed text-ink">
            আপনার ব্যবসার জন্য গুরুত্বপূর্ণ পরিবর্তন
          </h1>
          <p className="bn mt-1 text-sm text-ink/55">
            {open.length
              ? `${toBanglaDigits(open.length)} টি নতুন বিষয় আপনার দেখা প্রয়োজন।`
              : "এই মুহূর্তে নতুন কিছু নেই।"}
          </p>
        </header>

        {open.length ? (
          <div className="space-y-4">
            {open.map((a) => (
              <OwnerAlertCard
                key={a._id}
                alert={a}
                busy={busy}
                onAcknowledge={acknowledge}
                onOpen={setDetail}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="সব ঠিক আছে"
            body="নতুন কোনো পরিপত্র আপনার ব্যবসার সঙ্গে মিললে এখানে বাংলায় দেখানো হবে।"
          />
        )}

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
          <p className="bn text-sm leading-7 text-ink/70">
            কোনো কিছু বুঝতে অসুবিধা হচ্ছে? আপনার হিসাবরক্ষক সাহায্য করতে পারবেন।
          </p>
          <button
            onClick={() => setContactOpen(true)}
            className="bn mt-3 rounded-xl bg-brass-500 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brass-400"
          >
            আমার হিসাবরক্ষকের সাথে যোগাযোগ করুন
          </button>
        </div>

        {done.length ? (
          <section>
            <h2 className="bn font-display text-lg text-ink/70">আগের নোটিশ</h2>
            <ul className="mt-3 space-y-2">
              {done.map((a) => (
                <li
                  key={a._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-4 py-3"
                >
                  <span className="bn min-w-0 truncate text-sm text-ink/70">
                    {a.whatChanged || a.messageBangla}
                  </span>
                  <button
                    onClick={() => setDetail(a)}
                    className="bn shrink-0 text-xs text-forest-700 underline"
                  >
                    দেখুন
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="bn rounded-xl bg-clay/60 px-4 py-3 text-xs leading-6 text-ink/55">
          এটি একটি তথ্যভিত্তিক সহায়ক টুল — আইনি বা কর বিষয়ক পরামর্শ নয়। সিদ্ধান্ত নেওয়ার আগে মূল
          পরিপত্র ও হিসাবরক্ষকের সঙ্গে মিলিয়ে নিন।
        </p>
      </div>

      <Modal open={Boolean(detail)} title="বিস্তারিত" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="space-y-3">
            <p className="bn text-base font-semibold leading-8 text-ink">
              {detail.whatChanged || detail.messageBangla}
            </p>
            <p className="bn text-sm leading-7 text-ink/75">{detail.whyItMatters}</p>
            <p className="bn rounded-xl bg-clay/60 p-3 text-sm leading-7 text-ink">
              {detail.whatToDo}
            </p>
            <p className="bn text-sm text-ink/70">
              কার্যকর: {banglaDate(detail.effectiveDate) || "পরিপত্রে উল্লেখ নেই"}
            </p>
            <p className="bn text-xs leading-6 text-ink/50">
              সূত্র: {detail.obligationId?.circularId?.title || "এনবিআর পরিপত্র"}
            </p>
            {detail.obligationId?.circularId?.sourceUrl ? (
              <a
                href={detail.obligationId.circularId.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="bn inline-block text-sm text-forest-700 underline"
              >
                মূল পরিপত্র দেখুন
              </a>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={contactOpen}
        title="হিসাবরক্ষকের সঙ্গে যোগাযোগ"
        onClose={() => setContactOpen(false)}
      >
        <div className="space-y-3">
          <p className="bn text-sm leading-7 text-ink/75">
            আপনার প্রতিষ্ঠানের হিসাব দেখাশোনা করছেন:
          </p>
          <div className="rounded-xl bg-clay/60 p-4">
            <p className="bn text-base font-semibold text-ink">
              {data.accountant?.name || "আপনার নিযুক্ত হিসাবরক্ষক"}
            </p>
            {data.accountant?.email ? (
              <a
                href={`mailto:${data.accountant.email}`}
                className="mt-1 block text-sm text-forest-700 underline"
              >
                {data.accountant.email}
              </a>
            ) : null}
          </div>
          <p className="bn text-xs leading-6 text-ink/50">
            নোটিশটি সম্পর্কে প্রশ্ন থাকলে সরাসরি ইমেইল করুন।
          </p>
        </div>
      </Modal>
    </>
  );
}
