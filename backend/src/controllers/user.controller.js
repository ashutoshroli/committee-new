const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const PUBLIC_COLS = 'id, name, email, phone, role, is_active, created_at';

exports.getAll = asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT ${PUBLIC_COLS} FROM users ORDER BY created_at DESC`);
  res.json({ success: true, data: result.rows });
});

exports.getById = asyncHandler(async (req, res) => {
  const result = await db.query(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`, [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({ success: true, data: result.rows[0] });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'Email already exists.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await db.query(
    `INSERT INTO users (name, email, password, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING ${PUBLIC_COLS}`,
    [name, email, hash, phone || null, role || 'manager']
  );
  res.status(201).json({ success: true, message: 'User created.', data: result.rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  const { name, email, phone, role, is_active } = req.body;
  const result = await db.query(
    `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        role = COALESCE($4, role),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
     WHERE id = $6 RETURNING ${PUBLIC_COLS}`,
    [name, email, phone, role, is_active, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({ success: true, message: 'User updated.', data: result.rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }
  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({ success: true, message: 'User deleted.' });
});

/**
 * Grant login access to an existing member.
 * Creates a user account linked by email, using member's name/phone.
 */
exports.grantAccess = asyncHandler(async (req, res) => {
  const { member_id, email, password, role } = req.body;

  if (!member_id || !email || !password) {
    return res.status(400).json({ success: false, message: 'Member, email and password are required.' });
  }

  // Verify member exists
  const member = await db.query('SELECT * FROM members WHERE id = $1', [member_id]);
  if (member.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Member not found.' });
  }

  // Check if email already exists
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'Email already has login access.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const m = member.rows[0];
  const result = await db.query(
    `INSERT INTO users (name, email, password, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING ${PUBLIC_COLS}`,
    [m.name, email, hash, m.phone || null, role || 'manager']
  );

  res.status(201).json({ success: true, message: 'Login access granted.', data: result.rows[0] });
});

/**
 * Update only the role of a user (for permissions tab).
 */
exports.updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!role || !['superadmin', 'admin', 'subadmin', 'manager'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Valid role is required.' });
  }
  const result = await db.query(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING ${PUBLIC_COLS}`,
    [role, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({ success: true, message: 'Role updated.', data: result.rows[0] });
});

/**
 * Revoke login access (delete user account) - for permissions tab.
 */
exports.revokeAccess = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot revoke your own access.' });
  }
  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({ success: true, message: 'Login access revoked.' });
});
