import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiEdit2, FiTrash2 } from 'react-icons/fi';
import api from '../lib/api';
import { inr, fmtDate, MONTHS } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Card, Spinner, Empty, Badge, Modal, Field, inputClass } from '../components/ui';

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const canEdit = user?.role === 'superadmin' || user?.role === 'admin';
  const [loan, setLoan] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [availableFund, setAvailableFund] = useState(null);
  const [form, setForm] = useState({ payment_amount: '', payment_date: new Date().toISOString().split('T')[0], remarks: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/loans/${id}`)
      .then(async (res) => {
        setLoan(res.data.data);
        try {
          const s = await api.get(`/loans/${id}/schedule`);
          setSchedule(s.data.data.projected_schedule || []);
        } catch {
          setSchedule(null);
        }
      })
      .catch(() => setLoan(null))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  const pay = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/loans/${id}/payment`, {
        payment_amount: Number(form.payment_amount),
        payment_date: form.payment_date,
        remarks: form.remarks,
      });
      toast.success(res.data.message);
      setModal(false);
      setForm({ payment_amount: '', payment_date: new Date().toISOString().split('T')[0], remarks: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  const foreclose = async () => {
    if (!window.confirm(`Foreclose this loan for ${inr(loan.foreclosure_amount)}?`)) return;
    try {
      const res = await api.post(`/loans/${id}/foreclose`, { payment_date: new Date().toISOString().split('T')[0] });
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Foreclosure failed');
    }
  };

  const openEdit = () => {
    setEditForm({
      principal_amount: loan.principal_amount,
      interest_rate: loan.interest_rate,
      monthly_payment_amount: loan.monthly_payment_amount,
      tenure_months: loan.tenure_months || '',
      start_date: loan.start_date ? loan.start_date.split('T')[0] : '',
      status: loan.status,
      remarks: loan.remarks || '',
    });
    setEditModal(true);
    api.get('/dashboard/stats')
      .then((res) => setAvailableFund(res.data.data.fund.available))
      .catch(() => setAvailableFund(null));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/loans/${id}`, {
        principal_amount: Number(editForm.principal_amount),
        interest_rate: Number(editForm.interest_rate),
        monthly_payment_amount: Number(editForm.monthly_payment_amount),
        tenure_months: editForm.tenure_months ? Number(editForm.tenure_months) : null,
        start_date: editForm.start_date,
        status: editForm.status,
        remarks: editForm.remarks,
      });
      toast.success(res.data.message);
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const removeLoan = async () => {
    if (!window.confirm('Delete this loan permanently? This also reverses its fund entries and removes all its payments. This cannot be undone.')) return;
    try {
      const res = await api.delete(`/loans/${id}`);
      toast.success(res.data.message);
      navigate('/loans');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <Spinner />;
  if (!loan) return <Empty>Loan not found</Empty>;

  // ---- Repayment progress calculations ----
  const principal = Number(loan.principal_amount) || 0;
  const principalPaid = Number(loan.total_principal_paid) || 0;
  const interestPaid = Number(loan.total_interest_paid) || 0;
  const plannedTenure = loan.tenure_months ? Number(loan.tenure_months) : null;
  // EMIs paid = number of distinct months in which a (non-foreclosure) payment was made.
  // Multiple payments in the same month count as one EMI.
  const emiMonthKeys = new Set(
    (loan.payments || [])
      .filter((p) => p.payment_type !== 'foreclosure')
      .map((p) => `${p.year}-${p.month}`)
  );
  const paymentsMade = emiMonthKeys.size;
  const monthsLeft = loan.status === 'active' ? (schedule ? schedule.length : null) : 0;
  const principalPct = principal > 0 ? Math.min(100, Math.round((principalPaid / principal) * 100)) : 0;
  const totalPaid = principalPaid + interestPaid;

  // ---- Month-wise breakdown (groups multiple payments in a month into one EMI row) ----
  const monthlyMap = {};
  for (const p of loan.payments || []) {
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    if (!monthlyMap[key]) {
      monthlyMap[key] = { year: p.year, month: p.month, paid: 0, interest: 0, principal: 0, count: 0, foreclosed: false };
    }
    const m = monthlyMap[key];
    m.paid += Number(p.payment_amount);
    m.interest += Number(p.interest_component);
    m.principal += Number(p.principal_component);
    m.count += 1;
    if (p.payment_type === 'foreclosure') m.foreclosed = true;
  }
  const monthlyRows = Object.values(monthlyMap).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  const emiAmount = Number(loan.monthly_payment_amount) || 0;

  let estClose = null;
  if (loan.status === 'active' && monthsLeft != null && monthsLeft > 0) {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsLeft);
    estClose = d.toISOString().split('T')[0];
  }

  return (
    <div>
      <Link to="/loans" className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-800 mb-4">
        <FiArrowLeft /> Back to Loans
      </Link>

      <Card className="p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{loan.member_name}</h1>
            <p className="text-gray-500">Loan #{loan.id} · started {fmtDate(loan.start_date)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge value={loan.status} />
            {canEdit && (
              <button onClick={openEdit} title="Edit loan" className="text-gray-500 hover:text-yellow-600"><FiEdit2 /></button>
            )}
            {isSuperAdmin && (
              <button onClick={removeLoan} title="Delete loan" className="text-gray-500 hover:text-red-600"><FiTrash2 /></button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Box label="Principal" value={inr(loan.principal_amount)} />
          <Box label="Remaining" value={inr(loan.remaining_principal)} tone="red" />
          <Box label="Rate" value={`${loan.interest_rate}%/mo`} />
          <Box label="Monthly Payment" value={inr(loan.monthly_payment_amount)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <Box label="This Month Interest" value={inr(loan.current_month_interest)} tone="yellow" />
          <Box label="Foreclosure Amount" value={inr(loan.foreclosure_amount)} tone="purple" />
          <Box label="Total Interest Paid" value={inr(loan.total_interest_paid)} tone="green" />
        </div>

        {loan.status === 'active' && (
          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={() => setModal(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">Record Payment</button>
            <button onClick={foreclose} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Foreclose</button>
          </div>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Repayment Progress</h2>

        <div className="mb-5">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Principal repaid</span>
            <span className="font-medium">{inr(principalPaid)} / {inr(principal)} ({principalPct}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-brand-600 h-3 rounded-full transition-all" style={{ width: `${principalPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Box label="Total Tenure" value={plannedTenure ? `${plannedTenure} months` : 'Open-ended'} />
          <Box label="EMIs Paid" value={`${paymentsMade}`} tone="green" />
          <Box
            label="Months Left (approx)"
            value={loan.status === 'active' ? (monthsLeft != null ? `${monthsLeft} months` : '—') : '0 months'}
            tone="yellow"
          />
          <Box label="Est. Close" value={estClose ? fmtDate(estClose) : (loan.closed_date ? fmtDate(loan.closed_date) : '—')} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <Box label="Principal Paid" value={inr(principalPaid)} tone="green" />
          <Box label="Interest Paid" value={inr(interestPaid)} tone="green" />
          <Box label="Remaining Principal" value={inr(loan.remaining_principal)} tone="red" />
          <Box label="Total Paid" value={inr(totalPaid)} tone="purple" />
        </div>

        {plannedTenure && loan.status === 'active' && (
          <p className="text-xs text-gray-400 mt-3">
            {paymentsMade} of ~{plannedTenure} EMIs done · {monthsLeft != null ? `about ${monthsLeft} left` : ''} at the current EMI of {inr(loan.monthly_payment_amount)}.
          </p>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Month-wise Breakdown</h2>
        <p className="text-xs text-gray-400 mb-4">Multiple payments within a month are combined into a single EMI. Monthly EMI: {inr(emiAmount)}</p>
        {monthlyRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Month</Th><Th>EMI Due</Th><Th>Paid</Th><Th>Interest</Th><Th>Principal</Th><Th>Payments</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthlyRows.map((m) => {
                  const key = `${m.year}-${m.month}`;
                  const fullyPaid = m.paid + 0.01 >= emiAmount;
                  const status = m.foreclosed ? 'Foreclosed' : (fullyPaid ? 'Paid (1 EMI)' : 'Partial');
                  const statusCls = m.foreclosed
                    ? 'bg-purple-100 text-purple-700'
                    : (fullyPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700');
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{MONTHS[m.month - 1]} {m.year}</td>
                      <td className="px-4 py-2 text-gray-500">{inr(emiAmount)}</td>
                      <td className="px-4 py-2 font-medium">{inr(m.paid)}</td>
                      <td className="px-4 py-2 text-orange-600">{inr(m.interest)}</td>
                      <td className="px-4 py-2 text-green-600">{inr(m.principal)}</td>
                      <td className="px-4 py-2 text-gray-500">{m.count}{m.count > 1 ? ' payments' : ' payment'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusCls}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-6">No payments recorded yet.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        {loan.payments?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Date</Th><Th>Amount</Th><Th>Interest</Th><Th>Principal</Th><Th>Remaining</Th><Th>Type</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loan.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-2 font-medium">{inr(p.payment_amount)}</td>
                    <td className="px-4 py-2 text-orange-600">{inr(p.interest_component)}</td>
                    <td className="px-4 py-2 text-green-600">{inr(p.principal_component)}</td>
                    <td className="px-4 py-2">{inr(p.remaining_principal_after)}</td>
                    <td className="px-4 py-2"><Badge value={p.payment_type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-6">No payments recorded yet.</p>
        )}
      </Card>

      {modal && (
        <Modal title="Record Payment" onClose={() => setModal(false)}>
          {(() => {
            const pd = new Date(form.payment_date);
            const pm = pd.getMonth() + 1;
            const py = pd.getFullYear();
            const paidThisMonth = (loan.payments || [])
              .filter((p) => p.payment_type !== 'foreclosure' && p.month === pm && p.year === py)
              .reduce((s, p) => s + Number(p.payment_amount), 0);
            const remainThisMonth = Math.max(0, Math.round((emiAmount - paidThisMonth) * 100) / 100);
            return (
          <>
          <p className="text-sm text-gray-500 mb-2">
            Interest due {inr(loan.current_month_interest)} · Monthly EMI {inr(emiAmount)}
          </p>
          <div className={`text-sm mb-3 p-2 rounded-lg ${remainThisMonth <= 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
            {MONTHS[pm - 1]} {py}: paid {inr(paidThisMonth)} · you can pay up to <b>{inr(remainThisMonth)}</b> more this month.
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Quick label="Remaining EMI" onClick={() => setForm({ ...form, payment_amount: remainThisMonth })} />
            <Quick label="Interest Only" onClick={() => setForm({ ...form, payment_amount: loan.current_month_interest })} />
          </div>
          <form onSubmit={pay} className="space-y-3">
            <Field label="Amount (₹) *">
              <input type="number" required min="1" step="0.01" value={form.payment_amount}
                onChange={(e) => setForm({ ...form, payment_amount: e.target.value })} className={inputClass} />
              {Number(form.payment_amount) > remainThisMonth && (
                <p className="mt-1 text-xs text-red-600">Exceeds this month's remaining EMI ({inr(remainThisMonth)}). Multiple payments in a month count as one EMI.</p>
              )}
            </Field>
            <Field label="Payment Date">
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Remarks">
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={Number(form.payment_amount) > remainThisMonth} className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">Submit</button>
              <button type="button" onClick={() => setModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
          </>
            );
          })()}
        </Modal>
      )}
      {editModal && editForm && (
        <Modal title={`Edit Loan #${loan.id}`} onClose={() => setEditModal(false)}>
          {(() => {
            const currentPrincipal = Number(loan.principal_amount);
            // This loan already holds `currentPrincipal` from the pool, so the max it can be
            // re-set to is the current available fund plus what this loan already took out.
            const maxPrincipal = availableFund != null ? availableFund + currentPrincipal : null;
            const entered = Number(editForm.principal_amount || 0);
            const exceeds = maxPrincipal != null && entered > maxPrincipal;
            return (
          <form onSubmit={saveEdit} className="space-y-3">
            {availableFund != null && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Total Available Fund</span>
                  <span className="font-bold text-blue-800">{inr(availableFund)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Max principal for this loan</span>
                  <span className="font-bold text-blue-800">{inr(maxPrincipal)}</span>
                </div>
                <p className="text-xs text-blue-500">Available fund + ₹{currentPrincipal.toLocaleString('en-IN')} already disbursed to this loan.</p>
              </div>
            )}
            <Field label="Principal Amount (₹) *">
              <input type="number" required min="1" step="0.01" value={editForm.principal_amount}
                onChange={(e) => setEditForm({ ...editForm, principal_amount: e.target.value })}
                className={`${inputClass} ${exceeds ? 'border-red-400 focus:ring-red-400' : ''}`} />
              {exceeds ? (
                <p className="mt-1 text-xs text-red-600">
                  Principal exceeds the maximum allowed ({inr(maxPrincipal)}).
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Remaining is re-derived as principal minus principal already paid.</p>
              )}
            </Field>
            <Field label="Monthly Interest Rate (%) *">
              <input type="number" required min="0.01" step="0.01" value={editForm.interest_rate}
                onChange={(e) => setEditForm({ ...editForm, interest_rate: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Monthly Payment Amount (₹) *">
              <input type="number" required min="1" step="0.01" value={editForm.monthly_payment_amount}
                onChange={(e) => setEditForm({ ...editForm, monthly_payment_amount: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Tenure (months) — optional">
              <input type="number" min="1" value={editForm.tenure_months}
                onChange={(e) => setEditForm({ ...editForm, tenure_months: e.target.value })} className={inputClass} placeholder="Open-ended if empty" />
            </Field>
            <Field label="Start Date">
              <input type="date" value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Status">
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputClass}>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="foreclosed">Foreclosed</option>
              </select>
            </Field>
            <Field label="Remarks">
              <textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} className={inputClass} rows={2} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={exceeds} className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Changes</button>
              <button type="button" onClick={() => setEditModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function Box({ label, value, tone }) {
  const cls = { red: 'bg-red-50 text-red-600', yellow: 'bg-yellow-50', purple: 'bg-purple-50', green: 'bg-green-50' }[tone] || 'bg-gray-50';
  return (
    <div className={`p-3 rounded-lg ${cls}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
}
function Quick({ label, onClick }) {
  return <button type="button" onClick={onClick} className="text-xs bg-brand-100 text-brand-700 px-3 py-1.5 rounded hover:bg-brand-200">{label}</button>;
}
function Th({ children }) {
  return <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</th>;
}
