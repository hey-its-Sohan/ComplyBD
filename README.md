# ComplyBD

**Bangla Regulatory Intelligence for Bangladeshi SMEs.**
Blockchain Olympiad Bangladesh 2026 prototype.

> Informational compliance tool only. This system does not provide legal or tax
> advice. Please consult a licensed accountant or lawyer for high-stakes
> decisions.

---

## The problem

The National Board of Revenue publishes VAT and tax changes as dense Bangla
circulars and SROs. A restaurant owner in Dhaka has no realistic way to know
that a rate change applies to them, when it starts, or what happens if they miss
it. Their accountant, juggling dozens of clients, finds out late or not at all.

An LLM can read those circulars. But an LLM that confidently invents an
effective date or a penalty is worse than no tool at all, because the output
looks authoritative. Publishing a fabricated deadline to a shop owner is a real
harm.

## The solution

ComplyBD treats the AI as a proposer, never as an authority.

```
Bangla NBR circular
      ↓
AI extraction              a model proposes category, obligation, date, penalty
      ↓
Deterministic grounding    every field is searched for in the original text — no model
      ↓
Confidence                 weighted score with published rules and hard caps
      ↓
Human review               anything ungrounded is held for a named person
      ↓
Verified obligation        only now is it treated as guidance
      ↓
Business matching          matched to SME profiles by category
      ↓
Plain Bangla alert         what changed, why, what to do, by when, and the source
      ↓
Append-only audit          hash-chained; editing any record breaks every hash after it
      ↓
Blockchain hash anchor     one published digest makes tampering detectable
```

**The hard rule:** if the effective date or the penalty cannot be located in the
source text, confidence is capped at 45 and the obligation can never be
auto-verified. A reviewer may override that, but only with a written reason
recorded in the audit log under their name.

## Architecture

```
client/                     React 18 + Vite + Tailwind
  src/pages/                one file per screen
  src/components/           shared UI, all dependency-free

server/                     Node + Express
  src/services/
    regulatoryPipeline.js   orchestrator: ingest → extract → ground → score → route
    groundingEngine.js      deterministic verification, exact/variant/fuzzy matching
    banglaText.js           Bangla normalization with offset mapping, date parsing
    fieldLexicon.js         auditable Bangla surface terms for English enum labels
    confidence.js           weighted scoring, caps, routing rules
    obligationDecisions.js  shared verify/reject logic with the override gate
    obligationVersions.js   append-only version snapshots
    blockchainService.js    demo and testnet anchoring behind one interface
    demoMode.js             demo-mode detection and guards
    llm/                    provider abstraction (demo, OpenAI, Anthropic)
  src/utils/
    hash.js                 SHA-256, GENESIS, deterministic serialization
    audit.js                append-only writes, chain verification, anchoring
    match.js                verified-only business matching, Bangla alert copy
  src/models/               Mongoose schemas
  src/routes/               REST API
```

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Node.js 18+, Express |
| Database | MongoDB via Mongoose, with automatic in-memory fallback |
| Auth | JWT, bcrypt |
| AI | Pluggable: deterministic engine (default), OpenAI, Anthropic |
| Hashing | Node `crypto` SHA-256 |
| Chain | Simulated by default; optional EVM testnet via `ethers` |

No charting library, no component library, no blockchain SDK is required to run
the product.

---

## Installation

Requires **Node.js 18 or newer**. MongoDB is optional.

```bash
git clone <repository-url>
cd ComplyBD-main
npm install
```

`npm install` also installs `server/` and `client/` via a postinstall script. On
older PowerShell, run the three installs on separate lines rather than chaining
with `&&`.

## Running the application

```bash
npm run dev
```

Open **http://localhost:5173**. The API runs on `http://localhost:5000`; Vite
proxies `/api` to it.

If the database is empty the server seeds it automatically on startup.

| Command | What it does |
| --- | --- |
| `npm run dev` | API and frontend together |
| `npm run server` | API only |
| `npm run client` | Frontend only |
| `npm run seed` | Rebuild demo data from the command line |
| `npm test` | All five test suites — no database, network or wallet needed |
| `npm run build` | Production frontend build |

## Environment variables

Every value has a working default. Copy `server/.env.example` to `server/.env`
only if you want to change something.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `JWT_SECRET` | dev value | Token signing — change for any real deployment |
| `MONGO_URI` | in-memory | Falls back to an in-memory MongoDB if unreachable |
| `DEMO_MODE` | `true` | Enables the demo reset endpoint and sample data |
| `AI_PROVIDER` | `openai` | `openai`, `anthropic` or `demo` |
| `OPENAI_API_KEY` | empty | Blank means the deterministic engine is used |
| `ANTHROPIC_API_KEY` | empty | Alternative provider |
| `BLOCKCHAIN_RPC_URL` | empty | Blank means simulated anchors |
| `BLOCKCHAIN_PRIVATE_KEY` | empty | Both required for real testnet anchoring |
| `AUTO_ANCHOR_INTERVAL_MS` | `0` (off) | Periodic anchoring for unattended deployments |

## Demo credentials

Password for all three: `demo123`. The login page has a one-click button for
each.

| Role | Email | Sees |
| --- | --- | --- |
| Accountant | `accountant@complybd.com` | Clients, review queue, audit trail, anchors |
| Reviewer | `reviewer@complybd.com` | Review queue across all categories |
| SME owner | `owner@complybd.com` | Only their own shops' Bangla alerts |

**Reset demo data** on the login page rebuilds everything (`POST /api/demo/reset`,
available only while `DEMO_MODE` is on).

---

## Core workflow

### AI extraction

A provider proposes structured JSON: business category, obligation type,
effective date, penalty, required action, evidence quote, Bangla summary and a
self-reported confidence. Providers implement one four-member interface, so
adding a model means adding a file and one registry line.

With no API key, the deterministic engine reads the actual circular text — it
does not replay canned answers. If a configured provider fails mid-request the
system degrades to that engine rather than failing, and says so in the UI.

### Deterministic grounding

No model is involved. For each of the four checked fields, the engine searches
the original document in three passes: exact match, known surface form (a date
written `2026-09-01` is matched against `১ সেপ্টেম্বর ২০২৬`), then token overlap.
Anything found is stored with the verbatim snippet and its character offsets.

Two implementation details are load-bearing:

- **Normalization carries an offset map.** Collapsing whitespace, stripping
  zero-width joiners and converting ০-৯ to ASCII destroys character positions;
  the map lets every highlight point at the real words. A test asserts
  `documentText.slice(start, end) === evidence` for every span.
- **English enums need a Bangla lexicon.** Searching a Bangla circular for the
  literal string `"Restaurant"` fails every time. `fieldLexicon.js` maps each
  label to its accepted Bangla terms, and the same lists drive both detection and
  verification so the two cannot drift apart.

### Human review

Medium confidence goes to a pending queue; low confidence or any ungrounded
critical field goes to `needs_review`. The reviewer sees the AI's interpretation
beside the source document, field by field. Approving publishes alerts; rejecting
publishes nothing.

`POST /api/obligations/:id/verify` returns **409** when a critical field is
ungrounded. Overriding requires `override: true` and a written reason, logged as
`OBLIGATION_VERIFIED_WITH_OVERRIDE` under the reviewer's user id.

### Alert matching

Only verified obligations are matched — the guard lives in `matchAndAlert`, not
in its callers. Businesses are matched by category and authorization status, and
`matchedBusinessCount` is stored on the obligation. Urgency separates financial
impact (rate changes, withholding, device mandates) from procedural duties, so a
single circular does not mark everything urgent.

Each alert carries four stored Bangla fields — what changed, why it applies, what
to do, when it takes effect — so the accountant view and the owner view can never
show different explanations of the same change.

### Audit trail

Every significant action appends a record with `sequence`, `action`,
`entityType`, `entityId`, `actorId`, `metadata`, `previousHash`, `currentHash`
and `timestamp`. The first chains from the literal string `GENESIS`.
`GET /api/audit/verify` recomputes the entire chain and detects edits, deletions
and reordering.

Three decisions worth knowing:

- **Metadata is hashed with sorted keys.** A Mongo round-trip does not guarantee
  key order, so hashing `JSON.stringify(metadata)` directly would make an
  untampered chain fail verification at random.
- **Records carry an explicit `sequence`.** Several writes can land in the same
  millisecond, so ordering by timestamp alone leaves verification depending on an
  arbitrary tiebreak.
- **The digest covers `actorId`,** which the whitepaper's formula omits. Without
  it, the name attached to a decision could be changed without breaking the
  chain — and for a compliance record, who approved something is exactly the fact
  most worth protecting.

### Blockchain role

Deliberately narrow. The chain does one job: publish a single digest committing
to the audit trail, so tampering stays detectable even if the whole database were
rewritten. Only a 32-byte hash is ever published — no circular text, no business
data, no client names.

Demo anchors are deterministically derived from the audit hash, labelled
**"Prototype blockchain anchor"** wherever they appear, and can be independently
re-derived on the `/blockchain` page. `submitted` is true only when a transaction
was actually broadcast. Set `BLOCKCHAIN_RPC_URL` and `BLOCKCHAIN_PRIVATE_KEY`
(and `npm i ethers`) for real testnet anchoring.

### Versioned compliance record

Obligations carry `version`, `publishedAt`, `updatedAt` and `pipelineVersion`.
Every state change appends an immutable snapshot — version 1 is always the AI
draft, later versions record each human decision. Nothing is overwritten, so
"what did we publish on 3 September, and who approved it" stays answerable after
any correction.

### Role restrictions

Enforced on the server; the client guards only decide where to send someone who
lands on a URL they cannot use.

| Role | Sees |
| --- | --- |
| Owner | Only their own shops and alerts. No audit trail, no other clients. |
| Accountant | Only clients assigned to them, plus review queue and audit trail. |
| Reviewer | Review queue across all categories; never an individual owner's alerts. |

The audit trail is staff-only: its metadata names other clients and their
business ids.

### Data boundary

`toPublicCircular` in `services/llm/promptContract.js` is an allow-list, not a
convention. Only `title`, `documentText`, `publishedDate`, `sourceUrl` and
`source` can reach an external model. Business names, owner names, TINs, VAT BINs
and locations never leave the server, and a test asserts that adding them to a
circular object does not leak them into a prompt.

---

## Screens

| Route | Who | What |
| --- | --- | --- |
| `/accountant` | Accountant | Live funnel, compliance changes, trust panel |
| `/accountant/clients` | Accountant | Client table with category, alert and urgency filters |
| `/accountant/clients/:id` | Accountant | Profile, health, alerts, obligations, history |
| `/accountant/alerts` | Accountant | Every alert in the owner's four-question format |
| `/obligations/:id` | Staff | Full source provenance, evidence, versions, affected clients |
| `/intelligence` | Staff | The pipeline running, stage by stage |
| `/review` | Staff | AI interpretation beside the source document |
| `/owner` | SME owner | Bangla cards, "আমি বুঝেছি", contact the accountant |
| `/audit` | Staff | Hash-chained timeline, live verification, anchor controls |
| `/blockchain` | Staff | Anchor history and honest mode disclosure |
| `/how-it-works` | Everyone | Plain-language product explanation |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/circulars/:id/process` | Run the pipeline. `?dryRun=true` to preview |
| GET | `/api/obligations` | Filter by status, category, band, grounding |
| GET | `/api/obligations/:id` | Obligation, source, evidence, versions, affected clients |
| POST | `/api/obligations/:id/verify` | Verify and dispatch. 409 if a critical field is ungrounded |
| POST | `/api/obligations/:id/reject` | Reject; never sends alerts |
| GET | `/api/reviews/queue` | Review queue with a summary block |
| POST | `/api/reviews/:id/approve` | Same safeguards as verify |
| GET | `/api/dashboard/accountant` | Funnel counts, compliance changes, breakdown |
| GET | `/api/dashboard/owner` | The owner's alerts and their accountant's contact |
| POST | `/api/alerts/:id/acknowledge` | The owner's "আমি বুঝেছি" |
| GET | `/api/audit/verify` | Recompute every hash and report chain integrity |
| POST | `/api/audit/anchor` | Publish a digest committing to the whole trail |
| GET | `/api/blockchain/status` | Active mode, latest anchor, unanchored count |
| POST | `/api/demo/reset` | Rebuild all demo data (demo mode only) |

## Tests

```bash
npm test
```

Five suites, no database, network or wallet required:

| Suite | Covers |
| --- | --- |
| `services/pipeline.test.js` | Extraction, grounding, confidence, provider fallback, hallucination catching |
| `utils/audit.test.js` | Hash determinism, tamper detection, anchoring, data boundary |
| `routes/dashboard.test.js` | Dashboard and client scoping against real handlers |
| `routes/audit.test.js` | Audit and blockchain endpoints, role rejection |
| `tests/e2e.test.js` | The complete story: circular → alert → audit → anchor |

## Demo walkthrough

See **[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** for the timed five-minute
version. In brief:

1. Click **Reset demo data**, then **Login as Accountant**.
2. Dashboard: live funnel and compliance changes.
3. **Regulatory intelligence** → analyze the restaurant circular → 96%,
   auto-verified, four grounded fields with highlighted Bangla evidence.
4. Analyze the manufacturer circular → 45%, two fields flagged
   *"Not found in source"*, zero alerts sent.
5. **Login as Reviewer** → approve with a written override reason.
6. **Login as SME Owner** → the simplified Bangla alert.
7. **Audit trail** → ✓ chain intact, expand a record, see the override logged.
8. **Create blockchain anchor** → anchor id, records covered, honest labelling.
