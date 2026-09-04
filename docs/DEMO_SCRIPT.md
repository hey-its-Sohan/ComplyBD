# ComplyBD — 5-minute demo script

**Before you start:** open the login page and click **Reset demo data**. This
rebuilds every account, client, circular, alert and audit record, so the demo
starts from a known state no matter what a previous run did.

Total time: about 5 minutes. Timings are a guide, not a script to read aloud.

---

## 0 · Framing (20 seconds)

> Bangladeshi SME owners miss NBR rule changes because circulars are published
> as dense Bangla PDFs. An AI can read them — but an AI that invents a penalty
> or an effective date is worse than nothing. ComplyBD's answer is that the AI
> is never trusted on its own word.

Point at the login page's five numbered steps. Do not linger.

---

## 1 · Accountant dashboard (45 seconds)

Click **Login as Accountant**.

- Top of the page: **Bangla Regulatory Intelligence** and the funnel —
  circulars in, obligations extracted, verified, needing review, clients
  affected. Every number is live from the database.
- Say: *"One accountant, five SME clients, and the changes that actually touch
  them."*
- Scroll to **Compliance changes**. Each row shows the circular, category,
  effective date, urgency, verification state and how many of their clients it
  hits.

Do not explain the whole table. One row is enough.

---

## 2 · Run the pipeline on a clean circular (75 seconds)

Sidebar → **Regulatory intelligence**. The dropdown has two unprocessed
circulars marked with a bullet.

Select **এসআরও নং ২১১ — রেস্তোরাঁ** and click **Analyze circular**.

Let the five stages play. While they run:

> *"Document ingested. AI extraction. Then a grounding check that uses no model
> at all — it searches the original Bangla text for every value the AI
> proposed. Then confidence. Then routing."*

When it settles at **96%, high confidence, auto-verified**:

- **Field grounding table** — four rows, each with the AI's output beside the
  exact Bangla evidence and its character positions.
- Click the **Effective date** row. In the **source viewer** on the right, the
  highlight jumps to `১ সেপ্টেম্বর ২০২৬` in the circular.

> *"The highlight is drawn from character offsets recorded during grounding. It
> is pointing at the actual words that justified the date."*

---

## 3 · The safety case (60 seconds) — **the most important part**

Go back to the dropdown, select **পরিপত্র নং ০৯ — ক্ষুদ্র উৎপাদনকারী**, click
**Analyze circular**.

This circular defers its effective date to a later notification and its penalty
to a later order. The extraction engine still fills both in — from database
metadata and a generic clause.

Result: **45%, low confidence, sent to review**. Two rows turn red:
**"Not found in source — requires review."**

> *"The engine produced a plausible date and a plausible penalty. Neither is in
> the document. The grounding layer caught both, and this obligation reached
> zero businesses."*

Click **Verify and alert SMEs**. It is **refused** — the system asks for a
written override reason.

> *"The software will not publish this on its own. A named person has to take
> responsibility, in writing, and that reason goes into the audit trail."*

---

## 4 · Reviewer approves it (45 seconds)

Sidebar → sign out → **Login as Reviewer**.

The review queue shows the held obligation, flagged *"Ungrounded field — cannot
auto-publish."*

- Left panel: **AI interpretation**, field by field, with grounded/not grounded.
- Right panel: the **source document**.

Click **Approve and publish**, then supply an override reason:

> `Confirmed the effective date by phone with the NBR VAT wing.`

Alerts are published to the matching businesses.

---

## 5 · SME owner receives it (35 seconds)

Sign out → **Login as SME Owner**.

> *"This is what the shop owner sees. No confidence scores, no grounding
> vocabulary."*

- Headline in Bangla: **আপনার ব্যবসার জন্য গুরুত্বপূর্ণ পরিবর্তন**
- Cards marked 🔴 জরুরি / 🟡 গুরুত্বপূর্ণ, each answering: what changed, why it
  applies to them, what to do, by when, and the source.
- Click **আমি বুঝেছি** on one card.

---

## 6 · Audit trail and hash chain (45 seconds)

Sign out → **Login as Accountant** → sidebar → **Audit trail**.

- Green banner: **✓ Audit chain intact** — the result of recomputing every hash,
  not a stored flag.
- Expand any row to show `previousHash`, `currentHash` and metadata.
- Point out the override entry recorded under the reviewer's name.

> *"Every step is here — circular processed, obligation extracted, review
> performed, alerts published. Each record carries the hash of the one before
> it, so editing or deleting any of them breaks every hash after it."*

---

## 7 · Blockchain anchor (35 seconds)

Click **Create blockchain anchor**.

Show the anchor ID, records covered, and the timestamp.

> *"The chain is already tamper-evident against edits. But someone with database
> access could rebuild the whole chain and it would look consistent again.
> Publishing one digest they don't control removes that option."*

Be explicit about what this is:

> *"This is labelled a prototype anchor and it says so in the interface. It's
> deterministically derived from the audit hash, so you can re-derive it
> yourself — click **Verify this anchor** on the /blockchain page. Set an RPC URL
> and a key and the same code path submits a real testnet transaction. We're not
> claiming a mainnet transaction we didn't make."*

---

## 8 · Close (20 seconds)

> *"Bangla circular, AI extraction, deterministic grounding, confidence, human
> review, verified obligation, business matching, plain-Bangla alert, append-only
> audit, hash anchor. The AI is one step in that chain, and it's the only one
> that isn't trusted."*

Finish on the legal line, which appears on every screen:

> Informational compliance tool only. This system does not provide legal or tax
> advice. Please consult a licensed accountant or lawyer for high-stakes
> decisions.

---

## Demo accounts

Password for all three: `demo123`

| Button | Email | Sees |
| --- | --- | --- |
| Login as Accountant | `accountant@complybd.com` | Clients, review queue, audit, anchors |
| Login as Reviewer | `reviewer@complybd.com` | Review queue across categories |
| Login as SME Owner | `owner@complybd.com` | Only their own shops' Bangla alerts |

## If something goes wrong

| Symptom | Fix |
| --- | --- |
| Login fails | Click **Reset demo data** on the login page |
| Both demo circulars already processed | **Reset demo data** — they return to unprocessed |
| Audit chain shows ⚠ | Expected only if records were edited by hand; reset restores it |
| Backend unreachable | Check `npm run dev` is running; the API is on port 5000 |

## Questions judges tend to ask

**"Is the blockchain real?"**
In demo mode, no, and the interface says so on every anchor. It's a
deterministic digest you can re-derive from the audit hash. The same code path
submits a real testnet transaction when `BLOCKCHAIN_RPC_URL` and
`BLOCKCHAIN_PRIVATE_KEY` are set.

**"Does it work without an OpenAI key?"**
Yes — that's the default. The deterministic engine reads the actual circular
text rather than replaying canned answers. Grounding, confidence, review routing
and the audit chain behave identically either way.

**"Is client data sent to OpenAI?"**
No. Only the public circular text. `toPublicCircular` is an allow-list, and a
test asserts that business names, TINs and owner names cannot leak into a prompt.

**"What if the AI is wrong?"**
That's the point of section 3 of this demo. It was wrong, twice, on the second
circular — and neither error reached a business.
