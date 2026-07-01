const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLog');
const { ensureLoanRuleColumns } = require('../utils/settings');

exports.get = asyncHandler(async (req, res) => {
  await ensureLoanRuleColumns();
  const result = await db.query('SELECT * FROM committee_settings ORDER BY id LIMIT 1');
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Settings not found.' });
  }
  res.json({ success: true, data: result.rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  await ensureLoanRuleColumns();
  const {
    name, description, monthly_instalment, default_interest_rate,
    late_fine_per_day, late_fine_per_month, grace_period_days, payment_due_day,
    enforce_fund_limit, allow_advance_emi, compound_unpaid_interest, allow_foreclosure,
    loan_request_day, loan_request_from, loan_request_to, loan_instalment_due_day,
  } = req.body;

  const existing = await db.query('SELECT id FROM committee_settings ORDER BY id LIMIT 1');
  if (existing.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Settings not found.' });
  }

  const result = await db.query(
    `UPDATE committee_settings SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        monthly_instalment = COALESCE($3, monthly_instalment),
        default_interest_rate = COALESCE($4, default_interest_rate),
        late_fine_per_day = COALESCE($5, late_fine_per_day),
        late_fine_per_month = COALESCE($6, late_fine_per_month),
        grace_period_days = COALESCE($7, grace_period_days),
        payment_due_day = COALESCE($8, payment_due_day),
        enforce_fund_limit = COALESCE($9, enforce_fund_limit),
        allow_advance_emi = COALESCE($10, allow_advance_emi),
        compound_unpaid_interest = COALESCE($11, compound_unpaid_interest),
        allow_foreclosure = COALESCE($12, allow_foreclosure),
        loan_request_day = COALESCE($13, loan_request_day),
        loan_request_from = $14,
        loan_request_to = $15,
        loan_instalment_due_day = COALESCE($16, loan_instalment_due_day),
        updated_at = NOW()
     WHERE id = $17 RETURNING *`,
    [name, description, monthly_instalment, default_interest_rate,
     late_fine_per_day, late_fine_per_month, grace_period_days, payment_due_day,
     enforce_fund_limit, allow_advance_emi, compound_unpaid_interest, allow_foreclosure,
     loan_request_day, loan_request_from || null, loan_request_to || null, loan_instalment_due_day,
     existing.rows[0].id]
  );
  await logActivity(req, 'update', 'settings', existing.rows[0].id, 'Updated committee settings');
  res.json({ success: true, message: 'Settings updated.', data: result.rows[0] });
});
