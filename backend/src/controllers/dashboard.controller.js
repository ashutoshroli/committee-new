const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getStats = asyncHandler(async (req, res) => {
  const members = await db.query(
    'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM members'
  );

  const fund = await db.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type IN
        ('instalment_received','loan_payment_received','fine_received')), 0) AS total_in,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'loan_disbursed'), 0) AS total_out
    FROM fund_transactions
  `);
  const totalIn = Number(fund.rows[0].total_in);
  const totalOut = Number(fund.rows[0].total_out);

  const loans = await db.query(`
    SELECT COUNT(*)::int AS active_count,
           COALESCE(SUM(remaining_principal), 0) AS total_outstanding
    FROM loans WHERE status = 'active'
  `);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const collection = await db.query(`
    SELECT
      COALESCE(SUM(amount), 0) AS expected,
      COALESCE(SUM(paid_amount), 0) AS collected,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
      COUNT(*) FILTER (WHERE status IN ('unpaid','late'))::int AS unpaid
    FROM instalments WHERE month = $1 AND year = $2
  `, [month, year]);

  const interest = await db.query('SELECT COALESCE(SUM(total_interest_paid), 0) AS total FROM loans');

  res.json({
    success: true,
    data: {
      members: { total: members.rows[0].total, active: members.rows[0].active },
      fund: { total_in: totalIn, total_out: totalOut, available: Number((totalIn - totalOut).toFixed(2)) },
      loans: {
        active_count: loans.rows[0].active_count,
        total_outstanding: Number(loans.rows[0].total_outstanding),
      },
      current_month_collection: {
        month, year,
        expected: Number(collection.rows[0].expected),
        collected: Number(collection.rows[0].collected),
        total_members: collection.rows[0].total,
        paid: collection.rows[0].paid,
        unpaid: collection.rows[0].unpaid,
      },
      total_interest_earned: Number(interest.rows[0].total),
    },
  });
});
