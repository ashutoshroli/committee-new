const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLog');
const { getSettings } = require('../utils/settings');
const { ensureLoanRequestsTable } = require('../utils/loanRequestTable');
const { computeEmi, round2 } = require('../utils/loanMath');

const ADMIN_ROLES = ['superadmin', 'admin'];
const isAdmin = (req) => ADMIN_ROLES.includes(req.user.role);

// Find the committee member linked to the logged-in user (matched by email).
async function linkedMember(user) {
  if (!user.email) return null;
  const r = await db.query('SELECT * FROM members WHERE LOWER(email) = LOWER($1) LIMIT 1', [user.email]);
  return r.rows[0] || null;
}

async function availableFund() {
  const fund = await db.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type IN
        ('instalment_received','loan_payment_received','fine_received')), 0) AS total_in,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'loan_disbursed'), 0) AS total_out
    FROM fund_transactions
  `);
  return round2(Number(fund.rows[0].total_in) - Number(fund.rows[0].total_out));
}

// Pro-rata allocation of `fund` across rows by requested_amount (capped at requested).
function computeAllocation(rows, fund) {
  const totalReq = round2(rows.reduce((s, r) => s + Number(r.requested_amount), 0));
  const ratio = totalReq <= fund || totalReq === 0 ? 1 : fund / totalReq;
  const alloc = rows.map((r) => ({ id: r.id, allocated: round2(Number(r.requested_amount) * ratio) }));

  if (ratio < 1 && alloc.length) {
    // Correct any rounding drift so the total never exceeds the fund
    const sum = round2(alloc.reduce((s, a) => s + a.allocated, 0));
    const drift = round2(sum - fund);
    if (drift !== 0) {
      const idx = alloc.reduce((mi, a, i, arr) => (a.allocated > arr[mi].allocated ? i : mi), 0);
      alloc[idx].allocated = round2(Math.max(0, alloc[idx].allocated - drift));
    }
  }
  return alloc;
}

async function reallocate() {
  const fund = await availableFund();
  const rows = (await db.query(
    "SELECT id, requested_amount FROM loan_requests WHERE status = 'allocated'"
  )).rows;
  if (rows.length === 0) return;
  const alloc = computeAllocation(rows, fund);
  for (const a of alloc) {
    await db.query('UPDATE loan_requests SET allocated_amount = $1, updated_at = NOW() WHERE id = $2', [a.allocated, a.id]);
  }
}

function localDateStr(v) {
  if (!v) return null;
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayStr = () => localDateStr(new Date());

// Members may submit requests only while the window is open.
function requestWindowOpen(settings) {
  const from = localDateStr(settings?.loan_request_from);
  const to = localDateStr(settings?.loan_request_to);
  if (from || to) {
    const t = todayStr();
    if (from && t < from) return false;
    if (to && t > to) return false;
    return true;
  }
  // No dates configured -> fall back to the day-of-month rule (open before the close day)
  return new Date().getDate() < (settings?.loan_request_day || 10);
}

// Admin review/allocation is allowed once the window has closed.
function requestWindowClosed(settings) {
  const to = localDateStr(settings?.loan_request_to);
  if (to) return todayStr() > to;
  return new Date().getDate() >= (settings?.loan_request_day || 10);
}

function windowInfo(settings) {
  const from = localDateStr(settings?.loan_request_from);
  const to = localDateStr(settings?.loan_request_to);
  if (from || to) {
    return `Loan request window: ${from || 'any'} to ${to || 'any'}.`;
  }
  return `Loan requests close on day ${settings?.loan_request_day || 10} of the month.`;
}

// ---------- List ----------
exports.list = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const params = [];
  let where = '';
  if (!isAdmin(req)) {
    const m = await linkedMember(req.user);
    if (!m) return res.json({ success: true, data: [] });
    params.push(m.id);
    where = 'WHERE lr.member_id = $1';
  }
  const result = await db.query(
    `SELECT lr.*, m.name AS member_name, m.phone AS member_phone
     FROM loan_requests lr JOIN members m ON lr.member_id = m.id
     ${where}
     ORDER BY lr.created_at DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
});

// ---------- Summary ----------
exports.summary = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const settings = await getSettings();
  const fund = await availableFund();

  const active = await db.query(
    `SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(requested_amount), 0) AS total_requested,
        COALESCE(SUM(allocated_amount), 0) AS total_allocated
     FROM loan_requests
     WHERE status IN ('pending','approved','allocated')`
  );
  const byStatus = await db.query(
    "SELECT status, COUNT(*)::int AS count FROM loan_requests GROUP BY status"
  );

  res.json({
    success: true,
    data: {
      available_fund: fund,
      total_requested: Number(active.rows[0].total_requested),
      total_allocated: Number(active.rows[0].total_allocated),
      active_count: active.rows[0].count,
      by_status: byStatus.rows,
      loan_request_day: settings?.loan_request_day || 10,
      loan_request_from: localDateStr(settings?.loan_request_from),
      loan_request_to: localDateStr(settings?.loan_request_to),
      window_open: requestWindowOpen(settings),
      window_closed: requestWindowClosed(settings),
      default_interest_rate: Number(settings?.default_interest_rate || 0),
    },
  });
});

// ---------- Create ----------
exports.create = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const { requested_amount, tenure_months, purpose } = req.body;
  const amount = Number(requested_amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'A valid requested amount is required.' });
  }

  // Non-admins can only submit while the request window is open
  if (!isAdmin(req)) {
    const settings = await getSettings();
    if (!requestWindowOpen(settings)) {
      return res.status(400).json({ success: false, message: `The loan request window is currently closed. ${windowInfo(settings)}` });
    }
  }

  let memberId;
  if (isAdmin(req) && req.body.member_id) {
    memberId = Number(req.body.member_id);
  } else {
    const m = await linkedMember(req.user);
    if (!m) {
      return res.status(400).json({ success: false, message: 'No committee member is linked to your login. Ask an admin to grant access with your member email.' });
    }
    memberId = m.id;
  }

  const member = await db.query('SELECT id, name FROM members WHERE id = $1 AND is_active = true', [memberId]);
  if (member.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Active member not found.' });
  }

  const dup = await db.query(
    "SELECT id FROM loan_requests WHERE member_id = $1 AND status IN ('pending','approved','allocated')",
    [memberId]
  );
  if (dup.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'There is already an active loan request for this member.' });
  }

  const result = await db.query(
    `INSERT INTO loan_requests (member_id, requested_amount, tenure_months, purpose)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [memberId, amount, tenure_months ? Number(tenure_months) : null, purpose || null]
  );

  await logActivity(req, 'create', 'loan_request', result.rows[0].id, `Loan request of ${amount} by ${member.rows[0].name}`);
  res.status(201).json({ success: true, message: 'Loan request submitted.', data: result.rows[0] });
});

// ---------- Revoke (member or admin) ----------
exports.revoke = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const found = await db.query('SELECT * FROM loan_requests WHERE id = $1', [req.params.id]);
  if (found.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Loan request not found.' });
  }
  const lr = found.rows[0];

  if (!isAdmin(req)) {
    const m = await linkedMember(req.user);
    if (!m || m.id !== lr.member_id) {
      return res.status(403).json({ success: false, message: 'You can only revoke your own request.' });
    }
  }

  if (!['pending', 'approved', 'allocated'].includes(lr.status)) {
    return res.status(400).json({ success: false, message: `A ${lr.status} request cannot be revoked.` });
  }

  const wasAllocated = lr.status === 'allocated';
  await db.query("UPDATE loan_requests SET status = 'revoked', allocated_amount = 0, updated_at = NOW() WHERE id = $1", [lr.id]);

  // Redistribute the freed amount among the remaining allocated requests
  if (wasAllocated) await reallocate();

  await logActivity(req, 'revoke', 'loan_request', lr.id, `Revoked loan request #${lr.id}`);
  res.json({ success: true, message: wasAllocated ? 'Request revoked. Remaining allocations recalculated.' : 'Request revoked.' });
});

// ---------- Approve (admin, after window closes) ----------
exports.approve = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const settings = await getSettings();
  if (!requestWindowClosed(settings)) {
    return res.status(400).json({ success: false, message: `Requests are still open. Review is available after the window closes. ${windowInfo(settings)}` });
  }
  const result = await db.query(
    "UPDATE loan_requests SET status = 'approved', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *",
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Only pending requests can be approved.' });
  }
  await logActivity(req, 'approve', 'loan_request', result.rows[0].id, `Approved loan request #${result.rows[0].id}`);
  res.json({ success: true, message: 'Request approved.', data: result.rows[0] });
});

// ---------- Reject (admin, after window closes) ----------
exports.reject = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const settings = await getSettings();
  if (!requestWindowClosed(settings)) {
    return res.status(400).json({ success: false, message: `Requests are still open. Review is available after the window closes. ${windowInfo(settings)}` });
  }
  const found = await db.query('SELECT * FROM loan_requests WHERE id = $1', [req.params.id]);
  if (found.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Loan request not found.' });
  }
  if (!['pending', 'approved', 'allocated'].includes(found.rows[0].status)) {
    return res.status(400).json({ success: false, message: 'This request cannot be rejected.' });
  }
  const wasAllocated = found.rows[0].status === 'allocated';
  await db.query("UPDATE loan_requests SET status = 'rejected', allocated_amount = 0, updated_at = NOW() WHERE id = $1", [req.params.id]);
  if (wasAllocated) await reallocate();

  await logActivity(req, 'reject', 'loan_request', Number(req.params.id), `Rejected loan request #${req.params.id}`);
  res.json({ success: true, message: 'Request rejected.' });
});

// ---------- Allocate (admin, after window closes) ----------
exports.allocate = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const settings = await getSettings();
  if (!requestWindowClosed(settings)) {
    return res.status(400).json({ success: false, message: `Requests are still open. Review is available after the window closes. ${windowInfo(settings)}` });
  }

  const rows = (await db.query(
    "SELECT id, requested_amount FROM loan_requests WHERE status IN ('pending','approved','allocated')"
  )).rows;
  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: 'No requests to allocate.' });
  }

  const fund = await availableFund();
  const totalReq = round2(rows.reduce((s, r) => s + Number(r.requested_amount), 0));
  const alloc = computeAllocation(rows, fund);

  for (const a of alloc) {
    await db.query(
      "UPDATE loan_requests SET status = 'allocated', allocated_amount = $1, updated_at = NOW() WHERE id = $2",
      [a.allocated, a.id]
    );
  }

  await logActivity(req, 'allocate', 'loan_request', null,
    `Allocated ${fund} across ${rows.length} request(s) (total requested ${totalReq})`);
  res.json({
    success: true,
    message: totalReq <= fund
      ? 'Allocated. Available fund covers all requests fully.'
      : 'Allocated pro-rata (requests exceed the available fund).',
    data: { available_fund: fund, total_requested: totalReq, pro_rata: totalReq > fund, count: rows.length },
  });
});

// ---------- Distribute (admin) — turns allocations into real loans ----------
exports.distribute = asyncHandler(async (req, res) => {
  await ensureLoanRequestsTable();
  const settings = await getSettings();
  const rate = Number(settings?.default_interest_rate || 0);

  const rows = (await db.query(
    `SELECT lr.*, m.name AS member_name FROM loan_requests lr JOIN members m ON lr.member_id = m.id
     WHERE lr.status = 'allocated' AND lr.allocated_amount > 0`
  )).rows;
  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: 'No allocated requests to distribute. Run allocation first.' });
  }

  const created = [];
  const startStr = new Date().toISOString().split('T')[0];

  for (const lr of rows) {
    const principal = round2(Number(lr.allocated_amount));
    const tenure = lr.tenure_months ? Number(lr.tenure_months) : null;
    let emi = lr.monthly_payment_amount ? Number(lr.monthly_payment_amount) : null;
    if (!emi) {
      emi = tenure ? computeEmi(principal, rate, tenure) : round2(principal * (rate / 100) + principal / 12);
    }

    let endDate = null;
    if (tenure) {
      const e = new Date(startStr);
      e.setMonth(e.getMonth() + tenure);
      endDate = e.toISOString().split('T')[0];
    }

    const loan = await db.query(
      `INSERT INTO loans
          (member_id, principal_amount, remaining_principal, interest_rate,
           monthly_payment_amount, tenure_months, start_date, end_date, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [lr.member_id, principal, principal, rate, emi, tenure, startStr, endDate, `From loan request #${lr.id}`]
    );

    await db.query(
      `INSERT INTO fund_transactions (transaction_type, amount, reference_id, description, transaction_date)
       VALUES ('loan_disbursed', $1, $2, $3, $4)`,
      [principal, loan.rows[0].id, `Loan disbursed to ${lr.member_name} (request #${lr.id})`, startStr]
    );

    await db.query(
      "UPDATE loan_requests SET status = 'disbursed', interest_rate = $1, monthly_payment_amount = $2, loan_id = $3, updated_at = NOW() WHERE id = $4",
      [rate, emi, loan.rows[0].id, lr.id]
    );

    created.push({ request_id: lr.id, loan_id: loan.rows[0].id, member: lr.member_name, principal });
  }

  await logActivity(req, 'distribute', 'loan_request', null, `Distributed ${created.length} loan(s) from allocated requests`);
  res.json({ success: true, message: `Distributed ${created.length} loan(s).`, data: created });
});
