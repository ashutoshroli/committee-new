const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const { month, year, status } = req.query;
  const params = [];
  let q = `SELECT i.*, m.name AS member_name, m.phone AS member_phone
           FROM instalments i JOIN members m ON i.member_id = m.id WHERE 1=1`;

  if (month)  { params.push(month);  q += ` AND i.month = $${params.length}`; }
  if (year)   { params.push(year);   q += ` AND i.year = $${params.length}`; }
  if (status) { params.push(status); q += ` AND i.status = $${params.length}`; }
  q += ' ORDER BY i.due_date DESC, m.name ASC';

  const result = await db.query(q, params);
  res.json({ success: true, data: result.rows });
});

exports.getByMember = asyncHandler(async (req, res) => {
  const result = await db.query(
    'SELECT * FROM instalments WHERE member_id = $1 ORDER BY year DESC, month DESC',
    [req.params.memberId]
  );
  res.json({ success: true, data: result.rows });
});

exports.generateMonthly = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).json({ success: false, message: 'month and year are required.' });
  }

  const settings = await db.query('SELECT * FROM committee_settings ORDER BY id LIMIT 1');
  if (settings.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Committee settings not configured.' });
  }
  const { monthly_instalment, payment_due_day } = settings.rows[0];

  const existing = await db.query(
    'SELECT id FROM instalments WHERE month = $1 AND year = $2 LIMIT 1',
    [month, year]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ success: false, message: `Instalments already generated for ${month}/${year}.` });
  }

  const members = await db.query('SELECT id FROM members WHERE is_active = true');
  const dueDate = new Date(year, month - 1, payment_due_day || 5).toISOString().split('T')[0];

  let count = 0;
  for (const m of members.rows) {
    await db.query(
      'INSERT INTO instalments (member_id, amount, due_date, month, year) VALUES ($1,$2,$3,$4,$5)',
      [m.id, monthly_instalment, dueDate, month, year]
    );
    count += 1;
  }

  res.status(201).json({
    success: true,
    message: `Generated ${count} instalments for ${month}/${year}.`,
    data: { count, month, year, amount: Number(monthly_instalment) },
  });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const { paid_amount, paid_date, remarks } = req.body;
  if (!paid_amount || Number(paid_amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid paid_amount is required.' });
  }

  const found = await db.query('SELECT * FROM instalments WHERE id = $1', [req.params.id]);
  if (found.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Instalment not found.' });
  }

  const inst = found.rows[0];
  const newPaid = Number(inst.paid_amount) + Number(paid_amount);
  const total = Number(inst.amount);

  const payDate = paid_date ? new Date(paid_date) : new Date();
  const dueDate = new Date(inst.due_date);

  // Late fine
  let lateFine = 0;
  let status = newPaid >= total ? 'paid' : 'partial';
  if (payDate > dueDate) {
    const cfg = await db.query('SELECT late_fine_per_day, grace_period_days FROM committee_settings ORDER BY id LIMIT 1');
    const { late_fine_per_day, grace_period_days } = cfg.rows[0] || {};
    const diffDays = Math.floor((payDate - dueDate) / 86400000);
    const fineDays = Math.max(0, diffDays - (grace_period_days || 0));
    lateFine = Number((fineDays * Number(late_fine_per_day || 0)).toFixed(2));
    if (fineDays > 0 && status !== 'paid') status = 'late';
  }

  const dateStr = payDate.toISOString().split('T')[0];
  const updated = await db.query(
    `UPDATE instalments SET
        paid_amount = $1, status = $2, paid_date = $3,
        late_fine = late_fine + $4, remarks = COALESCE($5, remarks), updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [newPaid, status, dateStr, lateFine, remarks || null, inst.id]
  );

  await db.query(
    `INSERT INTO fund_transactions (transaction_type, amount, reference_id, description, transaction_date)
     VALUES ('instalment_received', $1, $2, $3, $4)`,
    [paid_amount, inst.id, `Instalment ${inst.month}/${inst.year}`, dateStr]
  );
  if (lateFine > 0) {
    await db.query(
      `INSERT INTO fund_transactions (transaction_type, amount, reference_id, description, transaction_date)
       VALUES ('fine_received', $1, $2, $3, $4)`,
      [lateFine, inst.id, `Late fine ${inst.month}/${inst.year}`, dateStr]
    );
  }

  res.json({
    success: true,
    message: 'Payment recorded.',
    data: { instalment: updated.rows[0], late_fine_charged: lateFine, status },
  });
});

exports.getMonthlySummary = asyncHandler(async (req, res) => {
  const { month, year } = req.params;
  const result = await db.query(
    `SELECT
        COUNT(*)::int AS total_members,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE status = 'partial')::int AS partial_count,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int AS unpaid_count,
        COUNT(*) FILTER (WHERE status = 'late')::int AS late_count,
        COALESCE(SUM(amount), 0) AS total_expected,
        COALESCE(SUM(paid_amount), 0) AS total_collected,
        COALESCE(SUM(late_fine), 0) AS total_fines
     FROM instalments WHERE month = $1 AND year = $2`,
    [month, year]
  );
  res.json({ success: true, data: result.rows[0] });
});
