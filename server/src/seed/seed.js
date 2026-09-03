const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Business = require("../models/Business");
const Circular = require("../models/Circular");
const Obligation = require("../models/Obligation");
const Alert = require("../models/Alert");
const AuditLog = require("../models/AuditLog");
const Anchor = require("../models/Anchor");
const { writeAudit, anchorAuditTrail } = require("../utils/audit");
const { DEMO_CIRCULARS } = require("./demoCirculars");
const { buildBanglaContent, priorityFromObligation } = require("../utils/match");
const ObligationVersion = require("../models/ObligationVersion");
const { recordVersion } = require("../services/obligationVersions");

const PASSWORD = "demo123";

const circularsRaw = [
  {
    title: "এসআরও নং ১৫৮-আইন/২০২৬/২৭ — রেস্তোরাঁ ও খাদ্য সেবায় মূসক হার পুনর্নির্ধারণ",
    source: "NBR / VAT Wing",
    sourceUrl: "https://nbr.gov.bd/circulars/sro-158-2026",
    publishedDate: new Date("2026-06-12"),
    effectiveDate: new Date("2026-09-15"),
    documentText: `জাতীয় রাজস্ব বোর্ড
মূসক উইং, ঢাকা

এসআরও নং ১৫৮-আইন/২০২৬/২৭
তারিখ: ১২ জুন ২০২৬

বিষয়: রেস্তোরাঁ, হোটেল ও খাদ্য সেবা প্রতিষ্ঠানে মূসক হার পুনর্নির্ধারণ।

জাতীয় রাজস্ব বোর্ড এতদ্বারা জানাচ্ছে যে, ১৫ সেপ্টেম্বর ২০২৬ তারিখ থেকে সকল নিবন্ধিত রেস্তোরাঁ ব্যবসায় ১৫% মূসক প্রযোজ্য হবে। পূর্বে প্রযোজ্য হ্রাসকৃত হার বাতিল করা হলো।

প্রতিটি রেস্তোরাঁ চালানে মূসক পৃথকভাবে প্রদর্শন করতে হবে এবং মাসিক মূসক রিটার্ন ই-পেপারলেস প্ল্যাটফর্মে দাখিল করতে হবে।

অমান্যকারীর বিরুদ্ধে জরিমানা ২৫,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ, যেটি বেশি, আরোপ করা যাবে।

সূত্র: মূল্য সংযোজন কর ও সম্পূরক শুল্ক আইন, ২০১২।`,
  },
  {
    title: "পরিপত্র নং ০৪/মূসক/২০২৬ — খুচরা দোকানে ইলেকট্রনিক ফিসকাল ডিভাইস",
    source: "NBR",
    sourceUrl: "https://nbr.gov.bd/circulars/vat-04-2026",
    publishedDate: new Date("2026-05-20"),
    effectiveDate: new Date("2026-11-01"),
    documentText: `জাতীয় রাজস্ব বোর্ড
মূসক অনুবিভাগ

পরিপত্র নং ০৪/মূসক/২০২৬
তারিখ: ২০ মে ২০২৬

বিষয়: খুচরা বিক্রেতাদের জন্য ইলেকট্রনিক ফিসকাল ডিভাইস (EFD) বাধ্যতামূলককরণ।

১ নভেম্বর ২০২৬ থেকে বার্ষিক টার্নওভার ৫০ লক্ষ টাকার অধিক সকল খুচরা দোকানকে অনুমোদিত ইলেকট্রনিক ফিসকাল ডিভাইস স্থাপন করতে হবে। POS চালান স্বয়ংক্রিয়ভাবে এনবিআর সার্ভারে প্রেরিত হবে।

ডিভাইস সংযোগ বিচ্ছিন্ন রাখা বা চালান ইস্যু না করা হলে জরিমানা ৫০,০০০ টাকা এবং নিবন্ধন স্থগিত হতে পারে।

ইলেকট্রনিক্স খুচরা বিক্রেতাদের ক্ষেত্রে সিরিয়াল নম্বর ও ওয়ারেন্টি তথ্য চালানে উল্লেখ বাধ্যতামূলক।`,
  },
  {
    title: "এসআরও নং ৯২-আইন/২০২৬ — পোশাক খুচরা ও ক্ষুদ্র উৎপাদনকারীর উৎসে কর",
    source: "NBR / Income Tax",
    sourceUrl: "https://nbr.gov.bd/circulars/sro-92-2026",
    publishedDate: new Date("2026-04-08"),
    effectiveDate: new Date("2026-12-15"),
    documentText: `জাতীয় রাজস্ব বোর্ড
আয়কর অনুবিভাগ

এসআরও নং ৯২-আইন/২০২৬
তারিখ: ০৮ এপ্রিল ২০২৬

বিষয়: পোশাক ব্যবসা ও ক্ষুদ্র উৎপাদনকারীর সরবরাহে উৎসে কর কর্তন।

১৫ ডিসেম্বর ২০২৬ থেকে পোশাক খুচরা প্রতিষ্ঠান স্থানীয় গার্মেন্টস সরবরাহকারীকে পরিশোধের সময় ৫% উৎসে কর কর্তন করবে। ক্ষুদ্র উৎপাদনকারী যদি মূসক নিবন্ধিত হয়, তবে চালানে BIN উল্লেখ করতে হবে।

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
    ObligationVersion.deleteMany({}),
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

  // Two circulars are left unprocessed on purpose. They are the live demo for
  // the Regulatory Intelligence page: one grounds cleanly and auto-verifies,
  // the other withholds its effective date and penalty so the grounding layer
  // has to catch the unsupported values and route it to human review.
  const demoCirculars = await Circular.create(
    DEMO_CIRCULARS.map(({ key, ...rest }) => ({ ...rest, status: "ingested" }))
  );

  const span = (field, text, doc) => {
    const start = doc.indexOf(text);
    return { field, text, start: start < 0 ? 0 : start, end: (start < 0 ? 0 : start) + text.length };
  };

  const obligations = await Obligation.create([
    {
      circularId: c1._id,
      businessCategory: "Restaurant",
      obligationType: "VAT Rate Change",
      requiredAction: "চালানে ১৫% মূসক আলাদাভাবে দেখান এবং POS/বিলিং সিস্টেমে নতুন হার হালনাগাদ করুন।",
      effectiveDate: c1.effectiveDate,
      penalty: "জরিমানা ২৫,০০০ টাকা অথবা অপ্রদত্ত করের সমপরিমাণ, যেটি বেশি, আরোপ করা যাবে",
      sourceSpans: [
        span("vatRate", "১৫% মূসক", c1.documentText),
        span("penalty", "জরিমানা ২৫,০০০ টাকা", c1.documentText),
        span("categoryHint", "রেস্তোরাঁ", c1.documentText),
      ],
      summaryBangla: "১৫ সেপ্টেম্বর ২০২৬ থেকে রেস্তোরাঁ ব্যবসায় ১৫% মূসক প্রযোজ্য। চালানে মূসক আলাদা দেখান এবং মাসিক ই-রিটার্ন দিন।",
      confidence: 94,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c1._id,
      businessCategory: "Restaurant",
      obligationType: "E-Return Filing",
      requiredAction: "প্রতি মাসের ১৫ তারিখের মধ্যে ই-পেপারলেস প্ল্যাটফর্মে মূসক রিটার্ন দাখিল করুন।",
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
      requiredAction: "অনুমোদিত ইলেকট্রনিক ফিসকাল ডিভাইস স্থাপন করুন এবং সংযোগ সচল রাখুন।",
      effectiveDate: c2.effectiveDate,
      penalty: "জরিমানা ৫০,০০০ টাকা এবং নিবন্ধন স্থগিত হতে পারে",
      sourceSpans: [
        span("device", "ইলেকট্রনিক ফিসকাল ডিভাইস", c2.documentText),
        span("penalty", "জরিমানা ৫০,০০০ টাকা", c2.documentText),
      ],
      summaryBangla: "১ নভেম্বর ২০২৬ থেকে ৫০ লক্ষ টাকার অধিক টার্নওভারের খুচরা দোকানে EFD স্থাপন বাধ্যতামূলক।",
      confidence: 90,
      groundingStatus: "grounded",
      reviewStatus: "verified",
      verifiedBy: reviewer._id,
    },
    {
      circularId: c2._id,
      businessCategory: "Electronics Shop",
      obligationType: "Invoice Data Fields",
      requiredAction: "চালানে পণ্যের সিরিয়াল নম্বর ও ওয়ারেন্টি তথ্য যোগ করুন।",
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
      requiredAction: "EFD ডিভাইস অনলাইনে রাখুন; সংযোগ বিচ্ছিন্ন হলে দ্রুত ঠিক করান।",
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
      requiredAction: "স্থানীয় সরবরাহকারীকে পরিশোধের সময় ৫% উৎসে কর কর্তন করে জমা দিন।",
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
      requiredAction: "প্রতিটি চালানে প্রতিষ্ঠানের BIN নম্বর উল্লেখ করুন।",
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
      requiredAction: "২ লক্ষ টাকার বেশি লেনদেনে ব্যাংক ট্রান্সফার ব্যবহার করুন।",
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
      requiredAction: "প্রতিটি চালানে মূসকের পরিমাণ পৃথক লাইনে দেখান।",
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

  const verifiedVat = obligations[0];
  const rejectedItem = obligations[7];

  // Alerts are built with the same helpers the live matcher uses, so a seeded
  // card and a freshly matched card are identical in shape and wording.
  //
  // Only verified obligations produce alerts. The pending Electronics item and
  // the ungrounded Retail item deliberately produce none — that absence is the
  // review gate doing its job, and it is visible on the dashboards.
  const verifiedObligations = obligations.filter((o) => o.reviewStatus === "verified");
  const authorized = businesses.filter((b) => b.authorizationStatus === "authorized");

  // A little status variety so the dashboards do not look uniformly unread.
  const seededStatus = {
    "E-Return Filing": "acknowledged",
    "Invoice Display": "seen",
  };

  const alertDocs = [];
  for (const ob of verifiedObligations) {
    const matches = authorized.filter((b) => b.category === ob.businessCategory);
    for (const b of matches) {
      const { whatChanged, whyItMatters, whatToDo } = buildBanglaContent(ob, b);
      alertDocs.push({
        obligationId: ob._id,
        businessId: b._id,
        priority: priorityFromObligation(ob),
        title: `${ob.obligationType} — ${b.name}`,
        messageBangla: `${b.name}: ${ob.summaryBangla}`,
        whatChanged,
        whyItMatters,
        whatToDo,
        effectiveDate: ob.effectiveDate || null,
        status: seededStatus[ob.obligationType] || "new",
        acknowledgedAt: seededStatus[ob.obligationType] === "acknowledged" ? new Date() : null,
        deliveredAt: new Date(),
      });
    }
  }

  await Alert.create(alertDocs);

  // Version history. Every obligation starts as an AI draft (v1); the ones a
  // human ruled on gain a second version recording that decision. This is what
  // the obligation detail page shows, and it is why a correction never erases
  // what was previously published.
  for (const ob of obligations) {
    await recordVersion({
      obligation: ob,
      changeType: "extracted",
      changeNote: "Extracted from the circular and checked against the source text.",
      actor: null,
    });

    if (ob.reviewStatus === "verified") {
      await recordVersion({
        obligation: ob,
        changeType: "verified",
        changeNote: `Approved by ${reviewer.name} and published to matching businesses.`,
        actor: reviewer,
      });
    } else if (ob.reviewStatus === "rejected") {
      await recordVersion({
        obligation: ob,
        changeType: "rejected",
        changeNote: `Rejected by ${reviewer.name}. Not supported by the circular text.`,
        actor: reviewer,
      });
    }
  }

  // Section F: record how many businesses each obligation actually reached.
  for (const ob of verifiedObligations) {
    ob.matchedBusinessCount = alertDocs.filter(
      (a) => String(a.obligationId) === String(ob._id)
    ).length;
    await ob.save();
  }

  for (const demo of demoCirculars) {
    await writeAudit({
      action: "CIRCULAR_INGESTED",
      entityType: "Circular",
      entityId: demo._id,
      actorId: accountant._id,
      metadata: { title: demo.title, awaitingPipeline: true },
    });
  }

  await writeAudit({
    action: "SEED_COMPLETED",
    entityType: "System",
    entityId: "seed",
    actorId: accountant._id,
    metadata: {
      businesses: businesses.length,
      circulars: circulars.length + demoCirculars.length,
      obligations: obligations.length,
    },
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
    entityId: rejectedItem._id,
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
  console.log("");
  console.log("Unprocessed demo circulars for the Regulatory Intelligence page:");
  demoCirculars.forEach((c) => console.log(`  - ${c.title}`));

  // Returned so the demo reset endpoint can report exactly what it rebuilt.
  const auditCount = await AuditLog.countDocuments();
  return {
    counts: {
      users: 5,
      businesses: businesses.length,
      circulars: circulars.length + demoCirculars.length,
      unprocessedCirculars: demoCirculars.length,
      obligations: obligations.length,
      alerts: alertDocs.length,
      auditRecords: auditCount,
      anchors: await Anchor.countDocuments(),
    },
  };
}

module.exports = { seed };
