/**
 * banglaText.js
 * -----------------------------------------------------------------------------
 * Deterministic Bangla/English text utilities used by the grounding engine.
 *
 * The single most important idea in this file is the *offset map*: whenever we
 * normalize text we keep an array that maps every character in the normalized
 * string back to its index in the ORIGINAL document. That lets the grounding
 * engine report exact character start/end positions in the source circular,
 * which is what the UI highlights. Without the map we could only say "yes it
 * matched somewhere" — with it we can point at the sentence.
 *
 * No external dependencies. Pure functions. Safe to unit test standalone.
 */

const ZERO_WIDTH = new Set([
  "\u200B", // zero width space
  "\u200C", // zero width non-joiner (very common in Bangla text)
  "\u200D", // zero width joiner
  "\uFEFF", // BOM
  "\u00AD", // soft hyphen
]);

const BENGALI_DIGITS = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

const ASCII_TO_BENGALI_DIGIT = {
  0: "০",
  1: "১",
  2: "২",
  3: "৩",
  4: "৪",
  5: "৫",
  6: "৬",
  7: "৭",
  8: "৮",
  9: "৯",
};

// Punctuation stripped in the "loose" normalization pass. Includes the Bangla
// danda (।) and the usual Latin marks plus both dash flavours.
const PUNCTUATION = new Set([
  "।", "॥", ".", ",", ";", ":", "!", "?", "'", '"', "“", "”", "‘", "’",
  "(", ")", "[", "]", "{", "}", "-", "–", "—", "/", "\\", "|", "*", "_",
  "%", "৳", "#", "@", "&", "+", "=", "<", ">", "~", "`",
]);

// Bangla month names, including the spelling variants that show up in real NBR
// circulars (আগষ্ট vs আগস্ট, ফেব্রুয়ারী vs ফেব্রুয়ারি, and so on).
const BANGLA_MONTHS = [
  { index: 1, names: ["জানুয়ারি", "জানুয়ারী", "জানুয়ারি মাস"], canonical: "জানুয়ারি" },
  { index: 2, names: ["ফেব্রুয়ারি", "ফেব্রুয়ারী", "ফেব্রুারি"], canonical: "ফেব্রুয়ারি" },
  { index: 3, names: ["মার্চ"], canonical: "মার্চ" },
  { index: 4, names: ["এপ্রিল"], canonical: "এপ্রিল" },
  { index: 5, names: ["মে"], canonical: "মে" },
  { index: 6, names: ["জুন"], canonical: "জুন" },
  { index: 7, names: ["জুলাই"], canonical: "জুলাই" },
  { index: 8, names: ["আগস্ট", "আগষ্ট", "অগাস্ট"], canonical: "আগস্ট" },
  { index: 9, names: ["সেপ্টেম্বর", "সেপ্টেম্বার", "সেপ্টম্বর"], canonical: "সেপ্টেম্বর" },
  { index: 10, names: ["অক্টোবর", "অক্টবর"], canonical: "অক্টোবর" },
  { index: 11, names: ["নভেম্বর", "নভেম্বার"], canonical: "নভেম্বর" },
  { index: 12, names: ["ডিসেম্বর", "ডিসেম্বার"], canonical: "ডিসেম্বর" },
];

const ENGLISH_MONTHS = [
  { index: 1, names: ["january", "jan"] },
  { index: 2, names: ["february", "feb"] },
  { index: 3, names: ["march", "mar"] },
  { index: 4, names: ["april", "apr"] },
  { index: 5, names: ["may"] },
  { index: 6, names: ["june", "jun"] },
  { index: 7, names: ["july", "jul"] },
  { index: 8, names: ["august", "aug"] },
  { index: 9, names: ["september", "sept", "sep"] },
  { index: 10, names: ["october", "oct"] },
  { index: 11, names: ["november", "nov"] },
  { index: 12, names: ["december", "dec"] },
];

const ENGLISH_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Very common Bangla/English function words. Excluded from token matching so a
// field does not count as "grounded" purely because the words "and"/"এর" appear.
const STOPWORDS = new Set([
  "এবং", "বা", "এর", "ও", "যে", "হবে", "করতে", "হইবে", "করা", "জন্য", "থেকে",
  "হতে", "এই", "সকল", "কোন", "কোনো", "তাহা", "উক্ত", "প্রতি", "নং", "মধ্যে",
  "the", "and", "or", "of", "to", "for", "in", "on", "at", "a", "an", "is",
  "be", "will", "shall", "any", "all", "by", "with", "from", "as", "that",
]);

/**
 * Lowercase a single character without ever changing its length.
 * (Some Unicode chars expand when lowercased; that would corrupt the offset map.)
 */
function safeLower(ch) {
  const lower = ch.toLowerCase();
  return lower.length === 1 ? lower : ch;
}

/**
 * Normalize text while recording where each output character came from.
 *
 * @param {string} text
 * @param {{ stripPunctuation?: boolean }} [options]
 * @returns {{ text: string, map: number[], source: string }}
 *          `map[i]` is the index in `source` that produced `text[i]`.
 */
function normalizeWithMap(text, options = {}) {
  const stripPunctuation = Boolean(options.stripPunctuation);
  const source = String(text == null ? "" : text).normalize("NFC");

  let out = "";
  const map = [];
  let pendingSpace = false;
  let started = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (ZERO_WIDTH.has(ch)) continue;

    if (/\s/.test(ch)) {
      if (started) pendingSpace = true;
      continue;
    }

    if (stripPunctuation && PUNCTUATION.has(ch)) {
      // Treat punctuation as a soft separator rather than deleting it silently,
      // so "১৫%মূসক" and "১৫% মূসক" normalize to the same token stream.
      if (started) pendingSpace = true;
      continue;
    }

    if (pendingSpace) {
      out += " ";
      map.push(i);
      pendingSpace = false;
    }

    const mapped = BENGALI_DIGITS[ch] !== undefined ? BENGALI_DIGITS[ch] : safeLower(ch);
    out += mapped;
    map.push(i);
    started = true;
  }

  return { text: out, map, source };
}

/** Convenience wrapper when offsets are not needed. */
function normalize(text, options) {
  return normalizeWithMap(text, options).text;
}

/** Convert every Bengali digit in a string to its ASCII equivalent. */
function toAsciiDigits(text) {
  return String(text == null ? "" : text).replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d]);
}

/** Convert every ASCII digit in a string to its Bengali equivalent. */
function toBengaliDigits(text) {
  return String(text == null ? "" : text).replace(/[0-9]/g, (d) => ASCII_TO_BENGALI_DIGIT[d]);
}

/**
 * Split normalized text into tokens with their offsets in the normalized string.
 * @returns {Array<{ token: string, start: number, end: number }>}
 */
function tokenizeWithOffsets(normalizedText) {
  const tokens = [];
  const re = /[^\s]+/g;
  let match;
  while ((match = re.exec(normalizedText)) !== null) {
    tokens.push({
      token: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

/** Content tokens worth matching on: length >= 2 and not a stopword. */
function contentTokens(text) {
  const normalized = normalize(text, { stripPunctuation: true });
  return tokenizeWithOffsets(normalized)
    .map((t) => t.token)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Parse a date out of a Bangla or English string.
 * Handles: "১ সেপ্টেম্বর ২০২৬", "01 September 2026", "2026-09-01", "01/09/2026".
 * @returns {{ year: number, month: number, day: number, iso: string } | null}
 */
function parseDateString(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      iso: value.toISOString().slice(0, 10),
    };
  }

  const raw = toAsciiDigits(String(value)).trim();

  const isoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = raw.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (slashMatch) {
    return buildDate(Number(slashMatch[3]), Number(slashMatch[2]), Number(slashMatch[1]));
  }

  const lower = raw.toLowerCase();

  for (const month of BANGLA_MONTHS) {
    for (const name of month.names) {
      const idx = raw.indexOf(name);
      if (idx < 0) continue;
      const before = raw.slice(Math.max(0, idx - 12), idx);
      const after = raw.slice(idx + name.length, idx + name.length + 14);
      const day = (before.match(/(\d{1,2})\s*,?\s*$/) || [])[1];
      const year = (after.match(/(\d{4})/) || [])[1];
      if (day && year) return buildDate(Number(year), month.index, Number(day));
    }
  }

  for (const month of ENGLISH_MONTHS) {
    for (const name of month.names) {
      const idx = lower.indexOf(name);
      if (idx < 0) continue;
      const before = lower.slice(Math.max(0, idx - 12), idx);
      const after = lower.slice(idx + name.length, idx + name.length + 14);
      const dayBefore = (before.match(/(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*$/) || [])[1];
      const dayAfter = (after.match(/^\s*,?\s*(\d{1,2})(?:st|nd|rd|th)?/) || [])[1];
      const year = (after.match(/(\d{4})/) || [])[1];
      const day = dayBefore || dayAfter;
      if (day && year) return buildDate(Number(year), month.index, Number(day));
    }
  }

  return null;
}

function buildDate(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, iso };
}

/**
 * Every plausible way a given date could be written in a Bangladeshi circular.
 * The grounding engine tries each of these against the source text, so an AI
 * that outputs "2026-09-01" can still be grounded against "১ সেপ্টেম্বর ২০২৬".
 */
function dateSurfaceForms(dateLike) {
  const parsed = parseDateString(dateLike);
  if (!parsed) return [];

  const { year, month, day } = parsed;
  const bnMonth = BANGLA_MONTHS.find((m) => m.index === month);
  const enMonth = ENGLISH_MONTH_NAMES[month - 1];

  const bnDay = toBengaliDigits(String(day));
  const bnDayPadded = toBengaliDigits(String(day).padStart(2, "0"));
  const bnYear = toBengaliDigits(String(year));

  const forms = new Set();

  if (bnMonth) {
    for (const name of bnMonth.names) {
      forms.add(`${bnDay} ${name} ${bnYear}`);
      forms.add(`${bnDayPadded} ${name} ${bnYear}`);
      forms.add(`${bnDay} ${name}, ${bnYear}`);
      forms.add(`${day} ${name} ${year}`);
      forms.add(`${bnDay} ${name}`);
    }
  }

  forms.add(`${day} ${enMonth} ${year}`);
  forms.add(`${String(day).padStart(2, "0")} ${enMonth} ${year}`);
  forms.add(`${enMonth} ${day}, ${year}`);
  forms.add(parsed.iso);
  forms.add(`${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`);
  forms.add(toBengaliDigits(`${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`));

  return [...forms].filter(Boolean);
}

/** Human-readable date for the UI, e.g. "1 September 2026". */
function formatDate(dateLike) {
  const parsed = parseDateString(dateLike);
  if (!parsed) return "";
  return `${parsed.day} ${ENGLISH_MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;
}

/** Bangla date rendering, e.g. "১ সেপ্টেম্বর ২০২৬". */
function formatDateBangla(dateLike) {
  const parsed = parseDateString(dateLike);
  if (!parsed) return "";
  const month = BANGLA_MONTHS.find((m) => m.index === parsed.month);
  return `${toBengaliDigits(String(parsed.day))} ${month ? month.canonical : ""} ${toBengaliDigits(String(parsed.year))}`.trim();
}

/**
 * Expand a character range in the source out to its surrounding sentence, so the
 * UI can show readable context around a short matched phrase.
 */
function sentenceAround(source, start, end, maxChars = 220) {
  const text = String(source || "");
  const boundaries = ["।", "\n", "\r"];
  let from = start;
  let to = end;

  while (from > 0 && start - from < maxChars && !boundaries.includes(text[from - 1])) from -= 1;
  while (to < text.length && to - end < maxChars && !boundaries.includes(text[to])) to += 1;

  return {
    text: text.slice(from, to).trim(),
    start: from,
    end: to,
  };
}

module.exports = {
  BANGLA_MONTHS,
  ENGLISH_MONTH_NAMES,
  STOPWORDS,
  normalize,
  normalizeWithMap,
  toAsciiDigits,
  toBengaliDigits,
  tokenizeWithOffsets,
  contentTokens,
  parseDateString,
  dateSurfaceForms,
  formatDate,
  formatDateBangla,
  sentenceAround,
};
