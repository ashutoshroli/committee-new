const db = require('../config/db');

let ensured = false;

/**
 * Loan-rule toggle columns are added to committee_settings lazily so the feature
 * works on databases created before these settings existed. Runs once per process.
 */
async function ensureLoanRuleColumns() {
  if (ensured) return;
  await db.query(`
    ALTER TABLE committee_settings ADD COLUMN IF NOT EXISTS enforce_fund_limit       BOOLEAN DEFAULT TRUE;
    ALTER TABLE committee_settings ADD COLUMN IF NOT EXISTS allow_advance_emi         BOOLEAN DEFAULT TRUE;
    ALTER TABLE committee_settings ADD COLUMN IF NOT EXISTS compound_unpaid_interest  BOOLEAN DEFAULT TRUE;
    ALTER TABLE committee_settings ADD COLUMN IF NOT EXISTS allow_foreclosure         BOOLEAN DEFAULT TRUE;
    ALTER TABLE committee_settings ADD COLUMN IF NOT EXISTS loan_request_day          INTEGER DEFAULT 10;
  `);
  ensured = true;
}

/** Fetch the single committee_settings row (ensuring loan-rule columns exist). */
async function getSettings() {
  await ensureLoanRuleColumns();
  const r = await db.query('SELECT * FROM committee_settings ORDER BY id LIMIT 1');
  return r.rows[0] || null;
}

module.exports = { ensureLoanRuleColumns, getSettings };
