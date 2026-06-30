// Initialize the database by running db/schema.sql
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

(async () => {
  try {
    const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schema);
    console.log('Database schema applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to apply schema:', err.message);
    process.exit(1);
  }
})();
