// =====================================================================
// Loan calculation helpers - reducing balance, monthly interest
// =====================================================================

/** Round to 2 decimals returning a Number. */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Monthly interest on reducing balance.
 * interest = remainingPrincipal * (monthlyRate / 100)
 */
function monthlyInterest(remainingPrincipal, monthlyRate) {
  return round2(Number(remainingPrincipal) * (Number(monthlyRate) / 100));
}

/**
 * Estimate tenure (months) for a reducing-balance loan paid with a
 * fixed monthly amount. Returns null if the payment never clears the
 * loan (payment <= first-month interest).
 */
function estimateTenure(principal, monthlyRate, monthlyPayment) {
  let remaining = Number(principal);
  const payment = Number(monthlyPayment);
  let months = 0;
  const MAX = 600; // 50-year safety cap

  while (remaining > 0.01 && months < MAX) {
    const interest = monthlyInterest(remaining, monthlyRate);
    const principalPortion = payment - interest;
    if (principalPortion <= 0) return null; // never closes
    remaining = round2(remaining - principalPortion);
    months += 1;
  }
  return months >= MAX ? null : months;
}

/**
 * Build a projected amortization schedule assuming the fixed monthly
 * payment is made every month.
 */
function buildSchedule(principal, monthlyRate, monthlyPayment, startDate) {
  const schedule = [];
  let remaining = Number(principal);
  const payment = Number(monthlyPayment);
  const start = new Date(startDate);
  let month = 0;

  while (remaining > 0.01 && month < 600) {
    month += 1;
    const interest = monthlyInterest(remaining, monthlyRate);
    let principalPortion = payment - interest;
    if (principalPortion <= 0) break; // would never close
    if (principalPortion > remaining) principalPortion = remaining;
    remaining = round2(remaining - principalPortion);

    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + month);

    schedule.push({
      month_number: month,
      due_date: dueDate.toISOString().split('T')[0],
      emi_amount: round2(interest + principalPortion),
      interest_component: interest,
      principal_component: round2(principalPortion),
      remaining_principal: remaining,
    });
  }
  return schedule;
}

/**
 * Apply a payment to a loan using reducing-balance rules.
 * Interest is covered first, the remainder reduces principal.
 * Any unpaid interest is compounded (added back to principal).
 */
function applyPayment(remainingPrincipal, monthlyRate, paymentAmount) {
  const principalBefore = Number(remainingPrincipal);
  const payment = Number(paymentAmount);
  const interest = monthlyInterest(principalBefore, monthlyRate);

  let interestComponent;
  let principalComponent;
  let paymentType;

  if (payment >= interest) {
    interestComponent = interest;
    principalComponent = Math.min(round2(payment - interest), principalBefore);
    if (principalComponent >= principalBefore) {
      paymentType = 'emi';
    } else if (payment === interest) {
      paymentType = 'interest_only';
    } else {
      paymentType = 'partial';
    }
  } else {
    // payment less than the interest due -> partial interest
    interestComponent = payment;
    principalComponent = 0;
    paymentType = 'partial';
  }

  const unpaidInterest = round2(interest - interestComponent);
  let newPrincipal = round2(principalBefore - principalComponent + unpaidInterest);
  if (newPrincipal < 0.01) newPrincipal = 0;

  return {
    interest,
    interestComponent: round2(interestComponent),
    principalComponent: round2(principalComponent),
    unpaidInterest,
    principalBefore: round2(principalBefore),
    newPrincipal,
    paymentType,
  };
}

module.exports = {
  round2,
  monthlyInterest,
  estimateTenure,
  buildSchedule,
  applyPayment,
};
