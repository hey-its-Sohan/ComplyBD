/**
 * fieldLexicon.js
 * -----------------------------------------------------------------------------
 * Two of the four checked fields are English enum labels — "Restaurant",
 * "VAT Rate Change" — while the source circular is in Bangla. Searching a Bangla
 * document for the string "Restaurant" would fail every time, which would make
 * the grounding engine reject correct extractions.
 *
 * So grounding an enum field means answering a slightly different question:
 * does the document contain a term that is a recognised indicator of this label?
 * This file is that mapping. It is a fixed, auditable lexicon — a reviewer can
 * read it and check it — not a model output.
 *
 * The same lists drive the demo extraction engine, so detection and verification
 * can never drift apart.
 */

const CATEGORY_TERMS = {
  Restaurant: ["রেস্তোরাঁ", "রেস্তোরা", "রেস্টুরেন্ট", "হোটেল", "খাদ্য সেবা", "খাবার দোকান", "restaurant"],
  "Retail Shop": ["খুচরা", "খুচরা বিক্রেতা", "দোকান", "রিটেইল", "পিওএস", "pos", "retail"],
  "Electronics Shop": ["ইলেকট্রনিক্স", "ইলেকট্রনিক", "মোবাইল ফোন", "কম্পিউটার", "গ্যাজেট", "electronics"],
  "Clothing Business": ["পোশাক", "বস্ত্র", "গার্মেন্টস", "তৈরি পোশাক", "clothing", "garments"],
  "Small Manufacturer": ["ক্ষুদ্র উৎপাদনকারী", "উৎপাদনকারী", "কারখানা", "ম্যানুফ্যাকচার", "প্রস্তুতকারক", "manufacturer"],
};

const OBLIGATION_TERMS = {
  "VAT Rate Change": ["মূসক হার", "ভ্যাট হার", "হার পুনর্নির্ধারণ", "মূসক আরোপিত", "মূসক প্রযোজ্য", "vat rate"],
  "EFD Device Mandate": ["ইলেকট্রনিক ফিসকাল ডিভাইস", "ফিসকাল ডিভাইস", "efd"],
  "Withholding Tax": ["উৎসে কর", "উৎসে কর্তন", "উৎসে কর কর্তন", "withholding"],
  "E-Return Filing": ["মূসক রিটার্ন", "রিটার্ন দাখিল", "ই-রিটার্ন", "রিটার্ন", "e-return"],
  "Invoice / Record Keeping": ["হিসাব সংরক্ষণ", "চালান", "ইনভয়েস", "নথি", "রেকর্ড", "invoice"],
  "Registration Requirement": ["নিবন্ধন", "বিআইএন", "bin", "registration"],
  "General Compliance": [],
};

/**
 * Surface terms that would justify grounding a given enum value.
 * Longest first, so the most specific evidence is preferred.
 */
function lexiconForms(field, value) {
  if (!value) return [];
  const table =
    field === "businessCategory" ? CATEGORY_TERMS : field === "obligationType" ? OBLIGATION_TERMS : null;
  if (!table) return [];
  const terms = table[value] || [];
  return [...terms].sort((a, b) => b.length - a.length);
}

/**
 * Bangla display names. Summaries and alerts are read by shop owners, so the
 * category must appear in Bangla even though the stored enum stays English.
 */
const CATEGORY_BANGLA = {
  Restaurant: "রেস্তোরাঁ",
  "Retail Shop": "খুচরা দোকান",
  "Electronics Shop": "ইলেকট্রনিক্স দোকান",
  "Clothing Business": "পোশাক ব্যবসা",
  "Small Manufacturer": "ক্ষুদ্র উৎপাদনকারী",
};

const OBLIGATION_BANGLA = {
  "VAT Rate Change": "মূসক হার পরিবর্তন",
  "EFD Device Mandate": "ইলেকট্রনিক ফিসকাল ডিভাইস",
  "Withholding Tax": "উৎসে কর কর্তন",
  "E-Return Filing": "মূসক রিটার্ন দাখিল",
  "Invoice / Record Keeping": "চালান ও হিসাব সংরক্ষণ",
  "Registration Requirement": "নিবন্ধন সংক্রান্ত বাধ্যবাধকতা",
  "General Compliance": "সাধারণ পরিপালন",
};

function banglaCategory(value) {
  return CATEGORY_BANGLA[value] || value || "";
}

function banglaObligation(value) {
  return OBLIGATION_BANGLA[value] || value || "";
}

/** Every category label, for validating model output. */
const CATEGORY_LABELS = Object.keys(CATEGORY_TERMS);
const OBLIGATION_LABELS = Object.keys(OBLIGATION_TERMS);

module.exports = {
  CATEGORY_TERMS,
  OBLIGATION_TERMS,
  CATEGORY_BANGLA,
  OBLIGATION_BANGLA,
  CATEGORY_LABELS,
  OBLIGATION_LABELS,
  banglaCategory,
  banglaObligation,
  lexiconForms,
};
