# ComplyBD

Hackathon prototype: **AI-Powered Regulatory Compliance Translator for Bangladeshi SMEs**.

Ingest NBR/VAT/SRO circulars, extract structured obligations, ground fields against the source text, send low-confidence drafts to human review, match verified rules to SME profiles, show plain-Bangla alerts, and keep an append-only hashed audit trail with simulated blockchain anchors.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT with seeded demo accounts

## Run (exact commands)

From the project root (`ComplyBD`):

```bash
npm install
npm run dev
```

`npm install` also installs `/server` and `/client` via a postinstall script. On older PowerShell, if you install packages by hand, run the three `npm install` commands on separate lines (do not use `&&`).

Then open **http://localhost:5173**

- API: `http://localhost:5000`
- Vite proxies `/api` to the backend

Optional: copy `server/.env.example` to `server/.env` and set `MONGO_URI` if you have MongoDB locally:

```
MONGO_URI=mongodb://127.0.0.1:27017/complybd
PORT=5000
JWT_SECRET=complybd-hackathon-secret
```

If the database is empty, the server **auto-seeds** demo data on startup.

Re-seed manually:

```bash
npm run seed
```

## Demo accounts

Password for all accounts: `demo123`

| Role       | Email                   |
| ---------- | ----------------------- |
| Accountant | accountant@complybd.com |
| SME owner  | owner@complybd.com      |
| Reviewer   | reviewer@complybd.com   |

The login page can fill these in with one click.

## What the demo shows

1. Accountant dashboard — clients, circulars, review load, verified alerts.
2. Alert details — Bangla message, obligation, highlighted source spans.
3. Review queue — low-confidence / pending items; verify (dispatches alerts) or reject.
4. SME owner dashboard — shops owned by রাকিব হাসান and Bangla notices.
5. Circulars — browse seeded NBR-style documents; ingest + extract a new one.
6. Audit trail — hash-chained logs and Merkle-root anchors on a simulated chain.
