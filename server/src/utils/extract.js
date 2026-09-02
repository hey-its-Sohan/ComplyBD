const { groundObligation } = require("./grounding");

const CATEGORY_RULES = [
  { category: "Restaurant", keywords: ["রেস্তোরাঁ", "হোটেল", "রেস্টুরেন্ট", "খাদ্য সেবা", "restaurant"] },
  { category: "Retail Shop", keywords: ["খুচরা", "দোকান", "POS", "ইলেকট্রনিক ফিসকাল", "retail"] },
  { category: "Electronics Shop", keywords: ["ইলেকট্রনিক্স", "মোবাইল", "কম্পিউটার", "electronics"] },
  { category: "Clothing Business", keywords: ["পোশাক", "বস্ত্র", "গার্মেন্টস", "clothing"] },
  { category: "Small Manufacturer", keywords: ["উৎপাদনকারী", "কারখানা", "ম্যানুফ্যাকচার", "manufacturer"] },
];

function detectCategories(text) {
  const found = CATEGORY_RULES.filter((rule) =>
    rule.keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()))
  ).map((r) => r.category);
  return found.length ? [...new Set(found)] : ["Retail Shop"];
}

function extractObligations(circular) {
  const text = circular.documentText || "";
  const categories = detectCategories(text);
  const drafts = [];

  const vatMatch = text.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:মূসক|VAT)/i) || text.match(/মূসক\s*(\d{1,2}(?:\.\d+)?)\s*%/i);
  const penaltyMatch = text.match(/জরিমানা[^\n।]{0,80}/) || text.match(/penalty[^\n.]{0,80}/i);
  const dateMatch = text.match(/(\d{1,2}\s*(?:জুলাই|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)\s*\d{4})/);

  categories.forEach((category) => {
    const vatRate = vatMatch ? `${vatMatch[1]}%` : null;
    const penalty = penaltyMatch ? penaltyMatch[0].trim() : "জরিমানা প্রযোজ্য হতে পারে";
    const effectiveHint = dateMatch ? dateMatch[1] : circular.effectiveDate;

    const summaryBangla = vatRate
      ? `${category} ব্যবসার জন্য ${vatRate} মূসক প্রযোজ্য। নির্ধারিত তারিখ থেকে চালান ও রিটার্নে হালনাগাদ করুন।`
      : `${category} ব্যবসার জন্য এই পরিপত্রের নির্দেশনা মেনে চলা বাধ্যতামূলক।`;

    const fields = {
      vatRate,
      penalty: penaltyMatch ? penaltyMatch[0].trim() : null,
      categoryHint: CATEGORY_RULES.find((r) => r.category === category)?.keywords[0],
    };

    const grounded = groundObligation(text, fields);
    drafts.push({
      circularId: circular._id,
      businessCategory: category,
      obligationType: vatRate ? "VAT Rate Change" : "Filing / Device Requirement",
      effectiveDate: circular.effectiveDate,
      penalty,
      sourceSpans: grounded.sourceSpans,
      summaryBangla,
      confidence: grounded.confidence,
      groundingStatus: grounded.groundingStatus,
      reviewStatus: grounded.confidence >= 75 ? "pending" : "needs_review",
      verifiedBy: null,
      extractedFields: { vatRate, effectiveHint },
    });
  });

  if (!drafts.length) {
    drafts.push({
      circularId: circular._id,
      businessCategory: "Retail Shop",
      obligationType: "General Compliance",
      effectiveDate: circular.effectiveDate,
      penalty: "প্রযোজ্য জরিমানা পরিপত্র অনুসারে",
      sourceSpans: [],
      summaryBangla: "এই পরিপত্রের নির্দেশনা সকল নিবন্ধিত ব্যবসার জন্য প্রযোজ্য।",
      confidence: 35,
      groundingStatus: "ungrounded",
      reviewStatus: "needs_review",
      verifiedBy: null,
    });
  }

  return drafts;
}

module.exports = { extractObligations, detectCategories };
