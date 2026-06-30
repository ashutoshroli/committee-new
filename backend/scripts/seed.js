// Seed a default super-admin user with a properly hashed password.
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const name = process.env.SEED_ADMIN_NAME || 'Super Admin';
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@committee.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`Super-admin already exists: ${email}`);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      [name, email, hash, 'superadmin']
    );

    console.log('Super-admin created:');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log('  (change the password after first login)');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
