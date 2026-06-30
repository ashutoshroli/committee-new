const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const user = result.rows[0];
  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'Account is deactivated.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    },
  });
});

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await db.query(
    'INSERT INTO users (name, email, password, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role',
    [name, email, hash, phone || null, role || 'manager']
  );

  const user = result.rows[0];
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { token: signToken(user), user },
  });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }

  const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
  res.json({ success: true, message: 'Password changed successfully.' });
});
