const db = require('../config/db');

let tableReady = false;

/**
 * Ensure the activity_logs table exists. Runs once per process so the feature
 * works even on databases created before this table was added to the schema.
 */
async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER,
      user_name    VARCHAR(255),
      user_role    VARCHAR(50),
      action       VARCHAR(50)  NOT NULL,
      entity_type  VARCHAR(50)  NOT NULL,
      entity_id    INTEGER,
      description  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
  `);
  tableReady = true;
}

/**
 * Record an activity. Designed to never throw — logging failures must not
 * break the main request flow.
 *
 * @param {object} req      Express request (for req.user)
 * @param {string} action   create | update | delete | payment | login | ...
 * @param {string} entity   loan | member | user | instalment | settings | auth
 * @param {number|null} entityId
 * @param {string} description Human readable summary
 */
async function logActivity(req, action, entity, entityId, description) {
  try {
    await ensureTable();
    const user = req && req.user ? req.user : {};
    await db.query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, entity_type, entity_id, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user.id || null, user.name || null, user.role || null, action, entity, entityId || null, description || null]
    );
  } catch (err) {
    console.error('[activityLog] failed to record activity:', err.message);
  }
}

module.exports = { logActivity, ensureActivityTable: ensureTable };
