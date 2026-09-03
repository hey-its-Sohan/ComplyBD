/**
 * demoCirculars.js
 * -----------------------------------------------------------------------------
 * The two circulars the Regulatory Intelligence demo is built around.
 *
 * DEMO_GROUNDED states its effective date and its penalty explicitly, so every
 * checked field can be located in the source and the obligation is eligible for
 * automatic verification.
 *
 * DEMO_UNGROUNDED deliberately withholds both: it defers the effective date to a
 * future notification and the penalty to a later order. The extraction engine
 * still fills those fields in (from database metadata and a generic clause),
 * which is exactly the kind of plausible-but-unsupported output the grounding
 * layer exists to catch. Processing it should produce low confidence and a
 * review-queue routing, never a verified alert.
 *
 * Both are realistic in form but fictional. They are not real NBR documents.
 */

const DEMO_GROUNDED = {
  key: "demo-grounded",
  title: "এসআরও নং ২১১-আইন/২০২৬/৩১ — রেস্তোরাঁ ও খাদ্য সেবায় মূসক হার পুনর্নির্ধারণ",
  source: "NBR / VAT Wing",
  sourceUrl: "https://nbr.gov.bd/circulars/sro-211-2026",
  publishedDate: new Date("2026-07-14"),
  effectiveDate: new Date("2026-09-01"),
  documentText: `জাতীয় রাজস্ব বোর্ড
মূসক উইং, রাজস্ব ভবন, ঢাকা

এসআরও নং ২১১-আইন/২০২৬/৩১
স্মারক তারিখ: ১৪ জুলাই ২০২৬

বিষয়: রেস্তোরাঁ, হোটেল ও খাদ্য সেবা প্রতিষ্ঠানে মূসক হার পুনর্নির্ধারণ এবং ইলেকট্রনিক চালান বাধ্যতামূলককরণ।

১। মূল্য সংযোজন কর ও সম্পূরক শুল্ক আইন, ২০১২ এর ক্ষমতাবলে জাতীয় রাজস্ব বোর্ড এতদ্বারা নির্দেশ প্রদান করিতেছে যে, নিবন্ধিত রেস্তোরাঁ ও খাদ্য সেবা প্রতিষ্ঠানের সরবরাহের উপর ১৫% মূসক আরোপিত হইবে।

২। এই আদেশ ১ সেপ্টেম্বর ২০২৬ তারিখ হইতে কার্যকর হবে।

৩। প্রতিটি রেস্তোরাঁকে গ্রাহকের অনুকূলে ইলেকট্রনিক চালান ইস্যু করিতে হইবে এবং চালানে মূসকের পরিমাণ পৃথকভাবে প্রদর্শন করিতে হইবে।

৪। মাসিক মূসক রিটার্ন পরবর্তী মাসের ১৫ তারিখের মধ্যে অনলাইনে দাখিল করিতে হইবে।

৫। নির্দেশনা অমান্য করিলে জরিমানা ৩০,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ অর্থ, যাহা অধিক হয়, আরোপ করা হইবে।

৬। এতদ্‌সংক্রান্ত পূর্ববর্তী সকল আদেশ, যতটুকু এই আদেশের সহিত অসামঞ্জস্যপূর্ণ, বাতিল বলিয়া গণ্য হইবে।

স্বাক্ষরিত
সদস্য (মূসক নীতি)
জাতীয় রাজস্ব বোর্ড`,
};

const DEMO_UNGROUNDED = {
  key: "demo-ungrounded",
  title: "পরিপত্র নং ০৯/মূসক/২০২৬ — ক্ষুদ্র উৎপাদনকারীর হিসাব সংরক্ষণ ও ডিজিটাল নথি",
  source: "NBR",
  sourceUrl: "https://nbr.gov.bd/circulars/vat-09-2026",
  publishedDate: new Date("2026-01-22"),
  // Note: this date exists only in the database. The document below never
  // states it, so any extraction that reports it must fail grounding.
  effectiveDate: new Date("2026-04-01"),
  documentText: `জাতীয় রাজস্ব বোর্ড
মূসক অনুবিভাগ

পরিপত্র নং ০৯/মূসক/২০২৬
স্মারক তারিখ: ২২ জানুয়ারি ২০২৬

বিষয়: ক্ষুদ্র উৎপাদনকারী ও কারখানা পর্যায়ে হিসাব সংরক্ষণ পদ্ধতির আধুনিকায়ন।

১। ক্ষুদ্র উৎপাদনকারী প্রতিষ্ঠানসমূহকে কাঁচামাল ক্রয়, উৎপাদন ও সরবরাহের হিসাব সংরক্ষণ ডিজিটাল পদ্ধতিতে সম্পন্ন করিতে হইবে।

২। কারখানা প্রাঙ্গণে রক্ষিত নথি চাহিবামাত্র সংশ্লিষ্ট মূসক কর্মকর্তার নিকট উপস্থাপন করিতে হইবে।

৩। ডিজিটাল হিসাব সংরক্ষণের কারিগরি নির্দেশিকা বোর্ডের ওয়েবসাইটে পর্যায়ক্রমে প্রকাশ করা হইবে।

৪। এই পরিপত্রের কার্যকর তারিখ পরবর্তী প্রজ্ঞাপনের মাধ্যমে জানানো হইবে।

৫। নির্দেশনা প্রতিপালনে ব্যর্থতার ক্ষেত্রে প্রযোজ্য ব্যবস্থা পরবর্তী আদেশে নির্ধারিত হইবে।

স্বাক্ষরিত
দ্বিতীয় সচিব (মূসক বাস্তবায়ন)
জাতীয় রাজস্ব বোর্ড`,
};

module.exports = {
  DEMO_GROUNDED,
  DEMO_UNGROUNDED,
  DEMO_CIRCULARS: [DEMO_GROUNDED, DEMO_UNGROUNDED],
};
