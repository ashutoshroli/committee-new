const db = require('../config/db');

let ensured = false;

/**
 * Lazily create the loan_requests table so the feature works on databases created
 * before it existed. Runs once per process.
 *
 * Status lifecycle:
 *   pending   -> member submitted, awaiting review (member can revoke)
 *   approved  -> admin approved, will be included in allocation (member can revoke)
 *   rejected  -> admin rejected
 *   revoked   -> member withdrew
 *   allocated -> allocation run assigned an amount (member can still revoke -> reallocation)
 *   disbursed -> converted into an actual loan
 */
async function ensureLoanRequestsTable() {
  if (ensured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS loan_requests (
      id                     SERIAL PRIMARY KEY,
      member_id              INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      requested_amount       NUMERIC(12, 2) NOT NULL,
      allocated_amount       NUMERIC(12, 2) DEFAULT 0,
      tenure_months          INTEGER,
      interest_rate          NUMERIC(5, 2),
      monthly_payment_amount NUMERIC(12, 2),
      purpose                TEXT,
      status                 VARCHAR(20) NOT NULL DEFAULT 'pending',
      loan_id                INTEGER REFERENCES loans(id) ON DELETE SET NULL,
      created_at             TIMESTAMPTZ DEFAULT NOW(),
      updated_at             TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON loan_requests(status);
    CREATE INDEX IF NOT EXISTS idx_loan_requests_member ON loan_requests(member_id);
  `);
  ensured = true;
}

module.exports = { ensureLoanRequestsTable };
