const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM members ORDER BY name ASC');
  res.json({ success: true, data: result.rows });
});

exports.getById = asyncHandler(async (req, res) => {
  const member = await db.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (member.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found.' });
  }

  const loans = await db.query(
    'SELECT * FROM loans WHERE member_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  const instalments = await db.query(
    `SELECT status, COUNT(*)::int AS count,
            SUM(amount) AS total_amount, SUM(paid_amount) AS total_paid
     FROM instalments WHERE member_id = $1 GROUP BY status`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: { ...member.rows[0], loans: loans.rows, instalment_summary: instalments.rows },
  });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, phone, email, address, committee_role, join_date } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }
  const result = await db.query(
    `INSERT INTO members (name, phone, email, address, committee_role, join_date)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, phone || null, email || null, address || null, committee_role || 'member', join_date || new Date()]
  );
  res.status(201).json({ success: true, message: 'Member added.', data: result.rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  const { name, phone, email, address, committee_role, is_active } = req.body;
  const result = await db.query(
    `UPDATE members SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        address = COALESCE($4, address),
        committee_role = COALESCE($5, committee_role),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [name, phone, email, address, committee_role, is_active, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found.' });
  }
  res.json({ success: true, message: 'Member updated.', data: result.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const activeLoans = await db.query(
    "SELECT id FROM loans WHERE member_id = $1 AND status = 'active'",
    [req.params.id]
  );
  if (activeLoans.rows.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete a member with active loans. Close their loans first.',
    });
  }
  const result = await db.query('DELETE FROM members WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found.' });
  }
  res.json({ success: true, message: 'Member deleted.' });
});
