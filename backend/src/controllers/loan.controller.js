const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { monthlyInterest, estimateTenure, buildSchedule, applyPayment, round2 } = require('../utils/loanMath');

function periodOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return { date: d.toISOString().split('T')[0], month: d.getMonth() + 1, year: d.getFullYear() };
}

// ---------- Read ----------
exports.getAll = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT l.*, m.name AS member_name, m.phone AS member_phone
     FROM loans l JOIN members m ON l.member_id = m.id
     ORDER BY l.created_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

exports.getById = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT l.*, m.name AS member_name, m.phone AS member_phone
     FROM loans l JOIN members m ON l.member_id = m.id WHERE l.id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Loan not found.' });
  }
  const loan = result.rows[0];

  const payments = await db.query(
    'SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date DESC, id DESC',
    [req.params.id]
  );
  const interestLog = await db.query(
    'SELECT * FROM loan_interest_log WHERE loan_id = $1 ORDER BY year DESC, month DESC',
    [req.params.id]
  );

  const currentInterest = monthlyInterest(loan.remaining_principal, loan.interest_rate);
  res.json({
    success: true,
    data: {
      ...loan,
      current_month_interest: currentInterest,
      foreclosure_amount: round2(Number(loan.remaining_principal) + currentInterest),
      payments: payments.rows,
      interest_log: interestLog.rows,
    },
  });
});

exports.getPayments = asyncHandler(async (req, res) => {
  const result = await db.query(
    'SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date DESC, id DESC',
    [req.params.id]
  );
  res.json({ success: true, data: result.rows });
});

exports.getSchedule = asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM loans WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Loan not found.' });
  }
  const loan = result.rows[0];
  const schedule = buildSchedule(
    loan.remaining_principal, loan.interest_rate, loan.monthly_payment_amount,
    new Date().toISOString().split('T')[0]
  );
  res.json({
    success: true,
    data: {
      loan_id: loan.id,
      remaining_principal: Number(loan.remaining_principal),
      monthly_payment: Number(loan.monthly_payment_amount),
      interest_rate: Number(loan.interest_rate),
      projected_schedule: schedule,
    },
  });
});

// ---------- Preview (no DB write) ----------
exports.preview = asyncHandler(async (req, res) => {
  const { principal_amount, interest_rate, monthly_payment_amount } = req.body;
  const principal = Number(principal_amount);
  const rate = Number(interest_rate);
  const payment = Number(monthly_payment_amount);

  if (!principal || !rate || !payment) {
    return res.status(400).json({ success: false, message: 'principal_amount, interest_rate and monthly_payment_amount are required.' });
  }

  const firstInterest = monthlyInterest(principal, rate);
  if (payment <= firstInterest) {
    return res.json({
      success: true,
      data: {
        first_month_interest: firstInterest,
        first_month_principal: 0,
        estimated_tenure_months: null,
        total_interest: null,
        total_payable: null,
        warning: 'Monthly payment is not greater than the first month interest. The loan would never close with this amount.',
      },
    });
  }

  const tenure = estimateTenure(principal, rate, payment);
  const schedule = buildSchedule(principal, rate, payment, new Date().toISOString().split('T')[0]);
  const totalInterest = round2(schedule.reduce((s, r) => s + r.interest_component, 0));

  res.json({
    success: true,
    data: {
      first_month_interest: firstInterest,
      first_month_principal: round2(payment - firstInterest),
      estimated_tenure_months: tenure,
      total_interest: totalInterest,
      total_payable: round2(principal + totalInterest),
      warning: null,
    },
  });
});

// ---------- Create ----------
exports.create = asyncHandler(async (req, res) => {
  const { member_id, principal_amount, interest_rate, monthly_payment_amount, tenure_months, start_date, remarks } = req.body;
  if (!member_id || !principal_amount || !interest_rate || !monthly_payment_amount) {
    return res.status(400).json({
      success: false,
      message: 'member_id, principal_amount, interest_rate and monthly_payment_amount are required.',
    });
  }

  const member = await db.query('SELECT id, name FROM members WHERE id = $1 AND is_active = true', [member_id]);
  if (member.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Active member not found.' });
  }

  const principal = Number(principal_amount);
  const rate = Number(interest_rate);
  const payment = Number(monthly_payment_amount);
  const firstInterest = monthlyInterest(principal, rate);

  const tenure = tenure_months ? Number(tenure_months) : estimateTenure(principal, rate, payment);
  const startStr = start_date || new Date().toISOString().split('T')[0];
  let endDate = null;
  if (tenure) {
    const e = new Date(startStr);
    e.setMonth(e.getMonth() + tenure);
    endDate = e.toISOString().split('T')[0];
  }

  const result = await db.query(
    `INSERT INTO loans
        (member_id, principal_amount, remaining_principal, interest_rate,
         monthly_payment_amount, tenure_months, start_date, end_date, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [member_id, principal, principal, rate, payment, tenure, startStr, endDate, remarks || null]
  );

  await db.query(
    `INSERT INTO fund_transactions (transaction_type, amount, reference_id, description, transaction_date)
     VALUES ('loan_disbursed', $1, $2, $3, $4)`,
    [principal, result.rows[0].id, `Loan disbursed to ${member.rows[0].name}`, startStr]
  );

  res.status(201).json({
    success: true,
    message: 'Loan created successfully.',
    data: { ...result.rows[0], calculated_tenure: tenure, first_month_interest: firstInterest },
  });
});

// ---------- Make payment ----------
exports.makePayment = asyncHandler(async (req, res) => {
  const { payment_amount, payment_date, remarks } = req.body;
  if (!payment_amount || Number(payment_amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid payment_amount is required.' });
  }

  const loanRes = await db.query("SELECT * FROM loans WHERE id = $1 AND status = 'active'", [req.params.id]);
  if (loanRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Active loan not found.' });
  }
  const loan = loanRes.rows[0];

  const calc = applyPayment(loan.remaining_principal, loan.interest_rate, payment_amount);
  const { date, month, year } = periodOf(payment_date);
  const newStatus = calc.newPrincipal === 0 ? 'closed' : 'active';

  const payRow = await db.query(
    `INSERT INTO loan_payments
        (loan_id, member_id, payment_amount, principal_component, interest_component,
         remaining_principal_after, payment_type, payment_date, month, year, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [loan.id, loan.member_id, Number(payment_amount), calc.principalComponent, calc.interestComponent,
     calc.newPrincipal, calc.paymentType, date, month, year, remarks || null]
  );

  await db.query(
    `UPDATE loans SET
        remaining_principal = $1,
        total_interest_paid = total_interest_paid + $2,
        total_principal_paid = total_principal_paid + $3,
        status = $4,
        closed_date = $5,
        updated_at = NOW()
     WHERE id = $6`,
    [calc.newPrincipal, calc.interestComponent, calc.principalComponent, newStatus,
     newStatus === 'closed' ? date : null, loan.id]
  );

  await db.query(
    `INSERT INTO fund_transactions (transaction_type, amount, reference_id, description, transaction_date)
     VALUES ('loan_payment_received', $1, $2, $3, $4)`,
    [Number(payment_amount), payRow.rows[0].id, `Loan payment (${calc.paymentType})`, date]
  );

  await db.query(
    `INSERT INTO loan_interest_log (loan_id, principal_at_start, interest_amount, is_compounded, month, year)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [loan.id, calc.principalBefore, calc.interest, calc.unpaidInterest > 0, month, year]
  );

  res.json({
    success: true,
    message: newStatus === 'closed' ? 'Payment successful. Loan is now closed!' : 'Payment recorded successfully.',
    data: {
      payment: payRow.rows[0],
      breakdown: {
        total_paid: Number(payment_amount),
        interest_covered: calc.interestComponent,
        principal_reduced: calc.principalComponent,
        unpaid_interest_compounded: calc.unpaidInterest > 0 ? calc.unpaidInterest : 0,
        previous_principal: calc.principalBefore,
        new_remaining_principal: calc.newPrincipal,
        loan_status: newStatus,
      },
    },
  });
});

// ---------- Foreclose ----------
exports.foreclose = asyncHandler(async (req, res) => {
  const loanRes = await db.query("SELECT * FROM loans WHERE id = $1 AND status = 'active'", [req.params.id]);
  if (loanRes.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Active loan not found.' });
  }
  const loan = loanRes.rows[0];
  const remaining = Number(loan.remaining_principal);
  const interest = monthlyInterest(remaining, loan.interest_rate);
  const amount = round2(remaining + interest);
  const { date, month, year } = periodOf(req.body.payment_date);

  const payRow = await db.query(
    `INSERT INTO loan_payments
        (loan_id, member_id, payment_amount, principal_component, interest_component,
         remaining_principal_after, payment_type, payment_date, month, year, remarks)
     VALUES ($1,$2,$3,$4,$5,0,'foreclosure',$6,$7,$8,'Loan foreclosure - no penalty') RETURNING *`,
    [loan.id, loan.member_id, amount, remaining, interest, date, month, year]
  );

  await db.query(
    `UPDATE loans SET
        remaining_principal = 0,
        total_interest_paid = total_interest_paid + $1,
        total_principal_paid = total_principal_paid + $2,
        status = 'foreclosed', closed_date = $3, updated_at = NOW()
     WHERE id = $4`,
    [interest, remaining, date, loan.id]
  );

  await db.query(
    `INSERT INTO fund_transactions (transaction_type, amount, reference_id, description, transaction_date)
     VALUES ('loan_payment_received', $1, $2, 'Loan foreclosure', $3)`,
    [amount, payRow.rows[0].id, date]
  );

  res.json({
    success: true,
    message: 'Loan foreclosed successfully. No penalty charged.',
    data: { foreclosure_amount: amount, principal_paid: remaining, interest_paid: interest, payment: payRow.rows[0] },
  });
});

// ---------- Monthly interest compounding for unpaid loans ----------
exports.processMonthlyInterest = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).json({ success: false, message: 'month and year are required.' });
  }

  const loans = await db.query("SELECT * FROM loans WHERE status = 'active'");
  const results = [];

  for (const loan of loans.rows) {
    const remaining = Number(loan.remaining_principal);
    const interest = monthlyInterest(remaining, loan.interest_rate);

    const paid = await db.query(
      'SELECT COALESCE(SUM(interest_component), 0) AS paid FROM loan_payments WHERE loan_id = $1 AND month = $2 AND year = $3',
      [loan.id, month, year]
    );
    const interestPaid = Number(paid.rows[0].paid);
    const unpaid = round2(interest - interestPaid);

    if (unpaid > 0) {
      const newPrincipal = round2(remaining + unpaid);
      await db.query('UPDATE loans SET remaining_principal = $1, updated_at = NOW() WHERE id = $2', [newPrincipal, loan.id]);
      await db.query(
        `INSERT INTO loan_interest_log (loan_id, principal_at_start, interest_amount, is_compounded, month, year)
         VALUES ($1,$2,$3,TRUE,$4,$5)`,
        [loan.id, remaining, unpaid, month, year]
      );
      results.push({ loan_id: loan.id, member_id: loan.member_id, unpaid_interest: unpaid, compounded: true, new_principal: newPrincipal });
    } else {
      results.push({ loan_id: loan.id, member_id: loan.member_id, interest_fully_paid: true });
    }
  }

  res.json({ success: true, message: `Monthly interest processed for ${month}/${year}.`, data: results });
});
