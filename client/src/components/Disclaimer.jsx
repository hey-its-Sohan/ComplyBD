/**
 * The product makes claims about tax and VAT obligations, so it says plainly
 * what it is. This appears on every screen via AppLayout and again, larger, on
 * the Regulatory Intelligence page.
 */
export default function Disclaimer({ variant = "inline" }) {
  const text =
    "Informational compliance tool only. This system does not provide legal or tax advice. Please consult a licensed accountant or lawyer for high-stakes decisions.";
  const short = "Informational compliance tool only — not legal or tax advice.";
  const bangla =
    "এটি একটি তথ্যভিত্তিক সহায়ক টুল — আইনি বা কর বিষয়ক পরামর্শ নয়। গুরুত্বপূর্ণ সিদ্ধান্তের আগে লাইসেন্সপ্রাপ্ত হিসাবরক্ষক বা আইনজীবীর পরামর্শ নিন।";

  if (variant === "bar") {
    return (
      <div className="border-t border-black/5 bg-white/70 px-6 py-2.5 text-[11px] leading-5 text-ink/45">
        {short} <span className="bn ml-1">{bangla}</span> Verify every obligation against the
        original circular before acting on it.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">{text}</p>
      <p className="bn mt-1 text-xs leading-6 text-amber-900/75">{bangla}</p>
      <p className="mt-1.5 text-xs leading-5 text-amber-900/70">
        ComplyBD reads published circulars and shows you where each field came from. It does not
        interpret the law for your business.
      </p>
    </div>
  );
}
