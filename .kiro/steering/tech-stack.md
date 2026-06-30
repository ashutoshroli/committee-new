# Tech Stack & Conventions

## Project Structure
- `db/` — SQL files only (schema, migrations, seed data) for Neon PostgreSQL
- `backend/` — Node.js + Express REST API (deploy: Render)
- `frontend/` — React + Vite + Tailwind CSS (deploy: Vercel)

## Technology Choices
| Layer | Technology | Deployment |
|-------|-----------|------------|
| Database | PostgreSQL | Neon |
| Backend | Node.js + Express | Render |
| Frontend | React + Vite + Tailwind CSS | Vercel |

## Conventions
- Backend uses CommonJS, `bcryptjs` for hashing, JWT for auth, `pg` Pool for DB access.
- All DB writes go through controllers; reusable loan math lives in `src/utils/loanMath.js`.
- API responses use `{ success, message?, data? }` shape.
- Frontend calls the API via `src/lib/api.js` (axios) with a configurable `VITE_API_URL`.
- Never commit `.env` or `node_modules` (see .gitignore).

## App Domain
- Single committee (app-level settings, not multi-tenant).
- Login roles: superadmin, admin, subadmin, manager.
- Committee member roles: president, secretary, treasurer, member.
- Loans: monthly reducing-balance interest, compound on unpaid, flexible/partial/interest-only
  payments, foreclosure with no penalty, auto-calculated tenure.
