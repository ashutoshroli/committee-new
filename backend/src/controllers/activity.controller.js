const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { ensureActivityTable } = require('../utils/activityLog');

// List activity logs (superadmin only - enforced at the route level).
exports.getAll = asyncHandler(async (req, res) => {
  await ensureActivityTable();

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const { action, entity_type } = req.query;

  const where = [];
  const params = [];
  if (action) { params.push(action); where.push(`action = $${params.length}`); }
  if (entity_type) { params.push(entity_type); where.push(`entity_type = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(limit);
  params.push(offset);

  const result = await db.query(
    `SELECT * FROM activity_logs ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, where.length);
  const total = await db.query(
    `SELECT COUNT(*)::int AS total FROM activity_logs ${whereSql}`,
    countParams
  );

  res.json({ success: true, data: result.rows, total: total.rows[0].total });
});
