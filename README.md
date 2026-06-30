# Committee Management System

A full-stack web app to manage a single savings committee / chit-fund group — members, monthly instalments, loans (reducing-balance interest), and fund tracking.

## Tech Stack

| Layer | Technology | Deployment |
|-------|-----------|------------|
| Database | PostgreSQL | Neon |
| Backend | Node.js + Express | Render |
| Frontend | React + Vite + Tailwind CSS | Vercel |

## Structure

```
committee-management/
├── db/
│   └── schema.sql            # PostgreSQL schema + seed (Neon)
├── backend/                  # Node.js + Express REST API
│   ├── scripts/              # initDb.js, seed.js
│   └── src/
│       ├── config/db.js
│       ├── middleware/       # auth (JWT + roles), errorHandler
│       ├── utils/loanMath.js # reducing-balance loan calculations
│       ├── controllers/
│       ├── routes/
│       └── index.js
└── frontend/                 # React (Vite + Tailwind)
    └── src/
        ├── lib/              # api client, formatters
        ├── context/          # AuthContext
        ├── components/       # Layout, UI primitives
        └── pages/            # Login, Dashboard, Members, Loans, Instalments, Settings, Users
```

## Features

- **Auth & roles** — JWT login. App roles: `superadmin`, `admin`, `subadmin`, `manager`.
- **Members** — CRUD with committee roles (`president`, `secretary`, `treasurer`, `member`).
- **Loans** — monthly reducing-balance interest, fixed monthly payment set at creation,
  flexible payments (full EMI / interest-only / partial / custom), unpaid interest compounds,
  foreclosure with no penalty, auto-calculated tenure + live preview.
- **Instalments** — generate monthly contributions for all active members, record payments,
  automatic late fine with grace period.
- **Dashboard** — available fund, active loans, current-month collection, interest earned.
- **Settings** — committee name, instalment amount, interest rate, late fines, grace period.

## Setup

### 1. Database (Neon)
Create a Neon PostgreSQL database and copy its connection string.

### 2. Backend
```bash
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET
npm install
npm run db:init               # apply schema
npm run db:seed               # create default super-admin
npm run dev                   # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env          # set VITE_API_URL
npm install
npm run dev                   # http://localhost:5173
```

## Default Login
Created by `npm run db:seed` (configurable via `.env`):
- Email: `admin@committee.com`
- Password: `admin123`  *(change after first login)*

## Loan Math (reducing balance)
- Monthly interest = `remaining_principal × (rate / 100)`
- A payment first covers interest; the remainder reduces principal.
- Any unpaid interest is **compounded** (added back to principal).
- Foreclosure amount = `remaining_principal + current_month_interest` (no penalty).
