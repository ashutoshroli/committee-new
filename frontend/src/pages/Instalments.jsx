import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiRefreshCw } from 'react-icons/fi';
import api from '../lib/api';
import { inr, fmtDate, MONTHS } from '../lib/format';
import { Card, PageTitle, Spinner, Badge, Modal, Field, inputClass } from '../components/ui';

export default function Instalments() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // selected instalment
  const [amount, setAmount] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/instalments?month=${month}&year=${year}`)
      .then((res) => setRows(res.data.data))
      .catch(() => toast.error('Failed to load instalments'))
      .finally(() => setLoading(false));
  }, [month, year]);
  useEffect(load, [load]);

  const generate = async () => {
    try {
      const res = await api.post('/instalments/generate', { month, year });
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate');
    }
  };

  const openPay = (inst) => {
    setModal(inst);
    setAmount(Number(inst.amount) - Number(inst.paid_amount));
  };

  const pay = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/instalments/${modal.id}/pay`, {
        paid_amount: Number(amount),
        paid_date: new Date().toISOString().split('T')[0],
      });
      toast.success('Payment recorded');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <PageTitle
        title="Monthly Instalments"
        action={
          <button onClick={generate} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2">
            <FiRefreshCw /> Generate {month}/{year}
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputClass} w-auto`}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputClass} w-auto`}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Summary value={rows.length} label="Total" />
          <Summary value={count('paid')} label="Paid" tone="green" />
          <Summary value={count('partial')} label="Partial" tone="yellow" />
          <Summary value={count('unpaid') + count('late')} label="Unpaid" tone="red" />
        </div>
      )}

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr><Th>Member</Th><Th>Amount</Th><Th>Paid</Th><Th>Due</Th><Th>Fine</Th><Th>Status</Th><Th className="text-right">Action</Th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.member_name}</p>
                      <p className="text-xs text-gray-500">{r.member_phone}</p>
                    </td>
                    <td className="px-4 py-3">{inr(r.amount)}</td>
                    <td className="px-4 py-3 text-green-600">{inr(r.paid_amount)}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(r.due_date)}</td>
                    <td className="px-4 py-3 text-red-600">{Number(r.late_fine) > 0 ? inr(r.late_fine) : '-'}</td>
                    <td className="px-4 py-3"><Badge value={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {r.status !== 'paid' && (
                        <button onClick={() => openPay(r)} className="text-brand-600 hover:text-brand-800 text-sm font-medium">Pay</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="text-center py-8 text-gray-500">No instalments for {MONTHS[month - 1]} {year}. Click Generate.</p>
          )}
        </Card>
      )}

      {modal && (
        <Modal title="Record Payment" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-500 mb-4">{modal.member_name} · due {inr(modal.amount)}</p>
          <form onSubmit={pay} className="space-y-3">
            <Field label="Amount (₹) *">
              <input type="number" required min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </Field>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">Pay</button>
              <button type="button" onClick={() => setModal(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Summary({ value, label, tone }) {
  const cls = { green: 'bg-green-50 text-green-600', yellow: 'bg-yellow-50 text-yellow-600', red: 'bg-red-50 text-red-600' }[tone] || 'bg-white text-gray-800';
  return (
    <div className={`p-4 rounded-xl border text-center ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
function Th({ children, className = '' }) {
  return <th className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>{children}</th>;
}
