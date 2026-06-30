import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';
import api from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { Card, Spinner, Empty, Badge, Modal, Field, inputClass } from '../components/ui';

export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ payment_amount: '', payment_date: new Date().toISOString().split('T')[0], remarks: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/loans/${id}`)
      .then((res) => setLoan(res.data.data))
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

  if (loading) return <Spinner />;
  if (!loan) return <Empty>Loan not found</Empty>;

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
          <Badge value={loan.status} />
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
          <p className="text-sm text-gray-500 mb-3">
            Interest due {inr(loan.current_month_interest)} · Set EMI {inr(loan.monthly_payment_amount)}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Quick label="Full EMI" onClick={() => setForm({ ...form, payment_amount: loan.monthly_payment_amount })} />
            <Quick label="Interest Only" onClick={() => setForm({ ...form, payment_amount: loan.current_month_interest })} />
            <Quick label="Foreclosure" onClick={() => setForm({ ...form, payment_amount: loan.foreclosure_amount })} />
          </div>
          <form onSubmit={pay} className="space-y-3">
            <Field label="Amount (₹) *">
              <input type="number" required min="1" step="0.01" value={form.payment_amount}
                onChange={(e) => setForm({ ...form, payment_amount: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Payment Date">
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Remarks">
              <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">Submit</button>
              <button type="button" onClick={() => setModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
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
