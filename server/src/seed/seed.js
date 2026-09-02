const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Business = require("../models/Business");
const Circular = require("../models/Circular");
const Obligation = require("../models/Obligation");
const Alert = require("../models/Alert");
const AuditLog = require("../models/AuditLog");
const Anchor = require("../models/Anchor");
const { writeAudit, anchorAuditTrail } = require("../utils/audit");

const PASSWORD = "demo123";

const circularsRaw = [
  {
    title: "এসআরও নং ১৫৮-আইন/২০২৫/২৬ — রেস্তোরাঁ ও খাদ্য সেবায় মূসক হার পুনর্নির্ধারণ",
    source: "NBR / VAT Wing",
    sourceUrl: "https://nbr.gov.bd/circulars/sro-158-2025",
    publishedDate: new Date("2025-06-12"),
    effectiveDate: new Date("2025-07-01"),
    documentText: `জাতীয় রাজস্ব বোর্ড
মূসক উইং, ঢাকা

এসআরও নং ১৫৮-আইন/২০২৫/২৬
তারিখ: ১২ জুন ২০২৫

বিষয়: রেস্তোরাঁ, হোটেল ও খাদ্য সেবা প্রতিষ্ঠানে মূসক হার পুনর্নির্ধারণ।

জাতীয় রাজস্ব বোর্ড এতদ্বারা জানাচ্ছে যে, ১ জুলাই ২০২৫ তারিখ থেকে সকল নিবন্ধিত রেস্তোরাঁ ব্যবসায় ১৫% মূসক প্রযোজ্য হবে। পূর্বে প্রযোজ্য হ্রাসকৃত হার বাতিল করা হলো।

প্রতিটি রেস্তোরাঁ চালানে মূসক পৃথকভাবে প্রদর্শন করতে হবে এবং মাসিক মূসক রিটার্ন ই-পেপারলেস প্ল্যাটফর্মে দাখিল করতে হবে।

অমান্যকারীর বিরুদ্ধে জরিমানা ২৫,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ, যেটি বেশি, আরোপ করা যাবে।

সূত্র: মূল্য সংযোজন কর ও সম্পূরক শুল্ক আইন, ২০১২।`,
  },
  {
    title: "পরিপত্র নং ০৪/মূসক/২০২৫ — খুচরা দোকানে ইলেকট্রনিক ফিসকাল ডিভাইস",
    source: "NBR",
    sourceUrl: "https://nbr.gov.bd/circulars/vat-04-2025",
    publishedDate: new Date("2025-05-20"),
    effectiveDate: new Date("2025-08-01"),
    documentText: `জাতীয় রাজস্ব বোর্ড
মূসক অনুবিভাগ

পরিপত্র নং ০৪/মূসক/২০২৫
তারিখ: ২০ মে ২০২৫

বিষয়: খুচরা বিক্রেতাদের জন্য ইলেকট্রনিক ফিসকাল ডিভাইস (EFD) বাধ্যতামূলককরণ।

১ আগস্ট ২০২৫ থেকে বার্ষিক টার্নওভার ৫০ লক্ষ টাকার অধিক সকল খুচরা দোকানকে অনুমোদিত ইলেকট্রনিক ফিসকাল ডিভাইস স্থাপন করতে হবে। POS চালান স্বয়ংক্রিয়ভাবে এনবিআর সার্ভারে প্রেরিত হবে।

ডিভাইস সংযোগ বিচ্ছিন্ন রাখা বা চালান ইস্যু না করা হলে জরিমানা ৫০,০০০ টাকা এবং নিবন্ধন স্থগিত হতে পারে।

ইলেকট্রনিক্স খুচরা বিক্রেতাদের ক্ষেত্রে সিরিয়াল নম্বর ও ওয়ারেন্টি তথ্য চালানে উল্লেখ বাধ্যতামূলক।`,
  },
  {
    title: "এসআরও নং ৯২-আইন/২০২৫ — পোশাক খুচরা ও ক্ষুদ্র উৎপাদনকারীর উৎসে কর",
    source: "NBR / Income Tax",
    sourceUrl: "https://nbr.gov.bd/circulars/sro-92-2025",
    publishedDate: new Date("2025-04-08"),
    effectiveDate: new Date("2025-07-15"),
    documentText: `জাতীয় রাজস্ব বোর্ড
আয়কর অনুবিভাগ

এসআরও নং ৯২-আইন/২০২৫
তারিখ: ০৮ এপ্রিল ২০২৫

বিষয়: পোশাক ব্যবসা ও ক্ষুদ্র উৎপাদনকারীর সরবরাহে উৎসে কর কর্তন।

১৫ জুলাই ২০২৫ থেকে পোশাক খুচরা প্রতিষ্ঠান স্থানীয় গার্মেন্টস সরবরাহকারীকে পরিশোধের সময় ৫% উৎসে কর কর্তন করবে। ক্ষুদ্র উৎপাদনকারী যদি মূসক নিবন্ধিত হয়, তবে চালানে BIN উল্লেখ করতে হবে।

কারখানা প্রাঙ্গণে নগদ লেনদেন ২ লক্ষ টাকার অধিক হলে ব্যাংক ট্রান্সফার বাধ্যতামূলক।

অমান্যে জরিমানা অকর্তিত অর্থের সমপরিমাণ এবং ভবিষ্যৎ ক্রেডিট স্থগিত।`,
  },
];

async function seed() {
  await Promise.all([
    User.deleteMany({}),
    Business.deleteMany({}),
    Circular.deleteMany({}),
    Obligation.deleteMany({}),
    Alert.deleteMany({}),
    AuditLog.deleteMany({}),
    Anchor.deleteMany({}),
  ]);

  const hash = await bcrypt.hash(PASSWORD, 10);

  const [accountant, reviewer, owner1, owner2, owner3] = await User.create([
    { name: "ফারহানা রহমান", email: "accountant@complybd.com", password: hash, role: "accountant" },
    { name: "নাবিলা চৌধুরী", email: "reviewer@complybd.com", password: hash, role: "reviewer" },
    { name: "রাকিব হাসান", email: "owner@complybd.com", password: hash, role: "owner" },
    { name: "সাবরিনা আক্তার", email: "owner2@complybd.com", password: hash, role: "owner" },
    { name: "ইমরান কবির", email: "owner3@complybd.com", password: hash, role: "owner" },
  ]);

  const businesses = await Business.create([
    {
      name: "ধানমন্ডি স্পাইস কিচেন",
      category: "Restaurant",
      location: "ধানমন্ডি ২৭, ঢাকা",
      ownerId: owner1._id,
      accountantId: accountant._id,
      authorizationStatus: "authorized",
      tin: "123456789012",
      vatBin: "000123456-0101",
    },
    {
      name: "গুলশান গার্ডেন বিস্ট্রো",
      category: "Restaurant",
      location: "গুলশান-২, ঢাকা",
      ownerId: owner2._id,
      accountantId: accountant._id,
      authorizationStatus: "authorized",
      tin: "123456789013",
      vatBin: "000123457-0101",
    },
    {
      name: "বনানী মিনি মার্ট",
      category: "Retail Shop",
      location: "বনানী ১১, ঢাকা",
      ownerId: owner1._id,
      accountantId: accountant._id,
      authorizationStatus: "authorized",
      tin: "123456789014",
      vatBin: "000123458-0101",
    },
    {
      name: "মতিঝিল গ্যাজেট হাব",
      category: "Electronics Shop",
      location: "মতিঝিল সি/এ, ঢাকা",
      ownerId: owner3._id,
      accountantId: accountant._id,
      authorizationStatus: "authorized",
      tin: "123456789015",
      vatBin: "000123459-0101",
    },
    {
      name: "নিউ মার্কেট স্টাইল হাউস",
      category: "Clothing Business",
      location: "নিউ মার্কেট, ঢাকা",
      ownerId: owner2._id,
      accountantId: accountant._id,
      authorizationStatus: "authorized",
      tin: "123456789016",
      vatBin: "000123460-0101",
    },
    {
      name: "কেরানীগঞ্জ লাইট ইঞ্জিনিয়ারিং",
      category: "Small Manufacturer",
      location: "কেরানীগঞ্জ, ঢাকা",
      ownerId: owner3._id,
      accountantId: accountant._id,
      authorizationStatus: "pending",
      tin: "123456789017",
      vatBin: "000123461-0101",
    },
  ]);

  const circulars = await Circular.create(circularsRaw.map((c) => ({ ...c, status: "extracted" })));
  const [c1, c2, c3] = circulars;

  const span = (field, text, doc) => {
    const start = doc.indexOf(text);
    return { field, text, start: start < 0 ? 0 : start, end: (start < 0 ? 0 : start) + text.length };
  };

  const obligations = await Obligation.create([
    {
      circularId: c1._id,
      businessCategory: "Restaurant",
      obligationType: "VAT Rate Change",
      effectiveDate: c1.effectiveDate,
      penalty: "জরিমানা ২৫,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ, যেটি বেশি, আরোপ করা যাবে",
      sourceSpans: [
        span("vatRate", "১৫% মূসক", c1.documentText),
        span("penalty", "জরিমানা ২৫,০০০ টাকা", c1.documentText),
        span("categoryHint", "রেস্তোরাঁ", c1.documentText),
      ],
      summaryBangla: "১ জুলাই ২০২৫ থেকে রেস্তোরাঁ ব্যবসায় ১৫% মূসক প্রযোজ্য। চালানে মূসক আলাদা দেখান এবং মাসিক ই-রিটার্ন দিন।",
      confidence: 94,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c1._id,
      businessCategory: "Restaurant",
      obligationType: "E-Return Filing",
      effectiveDate: c1.effectiveDate,
      penalty: "জরিমানা ২৫,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ",
      sourceSpans: [span("filing", "মাসিক মূসক রিটার্ন", c1.documentText)],
      summaryBangla: "রেস্তোরাঁগুলোকে ই-পেপারলেস প্ল্যাটফর্মে মাসিক মূসক রিটার্ন দাখিল করতে হবে।",
      confidence: 81,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c2._id,
      businessCategory: "Retail Shop",
      obligationType: "EFD Device Mandate",
      effectiveDate: c2.effectiveDate,
      penalty: "জরিমানা ৫০,০০০ টাকা এবং নিবন্ধন স্থগিত হতে পারে",
      sourceSpans: [
        span("device", "ইলেকট্রনিক ফিসকাল ডিভাইস", c2.documentText),
        span("penalty", "জরিমানা ৫০,০০০ টাকা", c2.documentText),
      ],
      summaryBangla: "১ আগস্ট ২০২৫ থেকে ৫০ লক্ষ টাকার অধিক টার্নওভারের খুচরা দোকানে EFD স্থাপন বাধ্যতামূলক।",
      confidence: 90,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c2._id,
      businessCategory: "Electronics Shop",
      obligationType: "Invoice Data Fields",
      effectiveDate: c2.effectiveDate,
      penalty: "জরিমানা ৫০,০০০ টাকা",
      sourceSpans: [span("serial", "সিরিয়াল নম্বর", c2.documentText)],
      summaryBangla: "ইলেকট্রনিক্স দোকানের চালানে পণ্যের সিরিয়াল নম্বর ও ওয়ারেন্টি তথ্য থাকতে হবে।",
      confidence: 77,
      groundingStatus: "partial",
      reviewStatus: "pending",
    },
    {
      circularId: c2._id,
      businessCategory: "Retail Shop",
      obligationType: "Server Connectivity",
      effectiveDate: c2.effectiveDate,
      penalty: "ডিভাইস সংযোগ বিচ্ছিন্ন রাখা বা চালান ইস্যু না করা হলে জরিমানা ৫০,০০০ টাকা",
      sourceSpans: [],
      summaryBangla: "EFD অফলাইনে রাখা যাবে না; চালান এনবিআর সার্ভারে স্বয়ংক্রিয় যাবে — এই খণ্ডের কিছু শর্ত উৎস পাঠে পুরোপুরি মিলছে না।",
      confidence: 38,
      groundingStatus: "ungrounded",
      reviewStatus: "needs_review",
    },
    {
      circularId: c3._id,
      businessCategory: "Clothing Business",
      obligationType: "Withholding Tax",
      effectiveDate: c3.effectiveDate,
      penalty: "জরিমানা অকর্তিত অর্থের সমপরিমাণ এবং ভবিষ্যৎ ক্রেডিট স্থগিত",
      sourceSpans: [span("wht", "৫% উৎসে কর", c3.documentText)],
      summaryBangla: "পোশাক খুচরা প্রতিষ্ঠান স্থানীয় সরবরাহকারীকে পরিশোধে ৫% উৎসে কর কর্তন করবে।",
      confidence: 86,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c3._id,
      businessCategory: "Small Manufacturer",
      obligationType: "BIN on Invoice",
      effectiveDate: c3.effectiveDate,
      penalty: "জরিমানা অকর্তিত অর্থের সমপরিমাণ",
      sourceSpans: [span("bin", "BIN উল্লেখ করতে হবে", c3.documentText)],
      summaryBangla: "মূসক নিবন্ধিত ক্ষুদ্র উৎপাদনকারীকে চালানে BIN উল্লেখ করতে হবে।",
      confidence: 72,
      groundingStatus: "partial",
      reviewStatus: "pending",
    },
    {
      circularId: c3._id,
      businessCategory: "Small Manufacturer",
      obligationType: "Cash Transaction Limit",
      effectiveDate: c3.effectiveDate,
      penalty: "জরিমানা অকর্তিত অর্থের সমপরিমাণ",
      sourceSpans: [span("cash", "নগদ লেনদেন ২ লক্ষ টাকা", c3.documentText)],
      summaryBangla: "কারখানায় ২ লক্ষ টাকার অধিক নগদ লেনদেন নিষিদ্ধ; ব্যাংক ট্রান্সফার ব্যবহার করুন।",
      confidence: 22,
      groundingStatus: "ungrounded",
      reviewStatus: "rejected",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c1._id,
      businessCategory: "Restaurant",
      obligationType: "Invoice Display",
      effectiveDate: c1.effectiveDate,
      penalty: "জরিমানা ২৫,০০০ টাকা",
      sourceSpans: [span("invoice", "চালানে মূসক পৃথকভাবে প্রদর্শন", c1.documentText)],
      summaryBangla: "প্রতিটি রেস্তোরাঁ চালানে মূসক পৃথকভাবে প্রদর্শন করতে হবে।",
      confidence: 88,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: accountant._id,
    },
  ]);

  const restaurants = businesses.filter((b) => b.category === "Restaurant" && b.authorizationStatus === "authorized");
  const retail = businesses.filter((b) => b.category === "Retail Shop" && b.authorizationStatus === "authorized");
  const electronics = businesses.filter((b) => b.category === "Electronics Shop");
  const clothing = businesses.filter((b) => b.category === "Clothing Business");

  const verifiedVat = obligations[0];
  const eReturn = obligations[1];
  const efd = obligations[2];
  const invoiceFields = obligations[3];
  const wht = obligations[5];
  const invoiceDisplay = obligations[8];

  const alertDocs = [];
  for (const b of restaurants) {
    alertDocs.push({
      obligationId: verifiedVat._id,
      businessId: b._id,
      priority: "high",
      title: `মূসক হার ১৫% — ${b.name}`,
      messageBangla: `${b.name}: ১ জুলাই ২০২৫ থেকে রেস্তোরাঁ সেবায় ১৫% মূসক দিতে হবে। চালান ও রিটার্ন হালনাগাদ করুন।`,
      status: b.name.includes("স্পাইস") ? "new" : "seen",
    });
    alertDocs.push({
      obligationId: eReturn._id,
      businessId: b._id,
      priority: "medium",
      title: `মাসিক ই-রিটার্ন — ${b.name}`,
      messageBangla: `${b.name}: ই-পেপারলেস প্ল্যাটফর্মে মাসিক মূসক রিটার্ন দাখিল বাধ্যতামূলক।`,
      status: "acknowledged",
    });
    alertDocs.push({
      obligationId: invoiceDisplay._id,
      businessId: b._id,
      priority: "medium",
      title: `চালানে মূসক আলাদা দেখান — ${b.name}`,
      messageBangla: `${b.name}: প্রতিটি চালানে মূসক পৃথকভাবে প্রদর্শন করুন।`,
      status: "new",
    });
  }
  for (const b of retail) {
    alertDocs.push({
      obligationId: efd._id,
      businessId: b._id,
      priority: "high",
      title: `EFD স্থাপন — ${b.name}`,
      messageBangla: `${b.name}: ১ আগস্ট ২০২৫ এর মধ্যে অনুমোদিত ইলেকট্রনিক ফিসকাল ডিভাইস বসান।`,
      status: "new",
    });
  }
  for (const b of electronics) {
    alertDocs.push({
      obligationId: invoiceFields._id,
      businessId: b._id,
      priority: "medium",
      title: `চালানে সিরিয়াল — ${b.name}`,
      messageBangla: `${b.name}: ইলেকট্রনিক্স চালানে সিরিয়াল নম্বর ও ওয়ারেন্টি তথ্য যোগ করুন।`,
      status: "seen",
    });
  }
  for (const b of clothing) {
    alertDocs.push({
      obligationId: wht._id,
      businessId: b._id,
      priority: "high",
      title: `৫% উৎসে কর — ${b.name}`,
      messageBangla: `${b.name}: স্থানীয় পোশাক সরবরাহকারীকে পরিশোধে ৫% উৎসে কর কর্তন করুন।`,
      status: "new",
    });
  }

  await Alert.create(alertDocs);

  await writeAudit({
    action: "SEED_COMPLETED",
    entityType: "System",
    entityId: "seed",
    actorId: accountant._id,
    metadata: { businesses: businesses.length, circulars: circulars.length, obligations: obligations.length },
  });
  await writeAudit({
    action: "CIRCULAR_INGESTED",
    entityType: "Circular",
    entityId: c1._id,
    actorId: accountant._id,
    metadata: { title: c1.title },
  });
  await writeAudit({
    action: "OBLIGATION_VERIFIED",
    entityType: "Obligation",
    entityId: verifiedVat._id,
    actorId: reviewer._id,
    metadata: { confidence: 94 },
  });
  await writeAudit({
    action: "OBLIGATION_REJECTED",
    entityType: "Obligation",
    entityId: obligations[7]._id,
    actorId: reviewer._id,
    metadata: { reason: "insufficient grounding" },
  });
  await writeAudit({
    action: "ALERTS_DISPATCHED",
    entityType: "Alert",
    entityId: "batch",
    actorId: accountant._id,
    metadata: { count: alertDocs.length },
  });

  await anchorAuditTrail();

  console.log("Seed complete.");
  console.log("Demo accounts (password: demo123):");
  console.log("  accountant@complybd.com");
  console.log("  owner@complybd.com");
  console.log("  reviewer@complybd.com");
}

module.exports = { seed };
