import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiCheck, FiX, FiPieChart, FiSend } from 'react-icons/fi';
import api from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Card, PageTitle, Spinner, Badge, Modal, Field, inputClass } from '../components/ui';

const REQ_STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  revoked: 'bg-gray-100 text-gray-500',
  allocated: 'bg-purple-100 text-purple-700',
  disbursed: 'bg-green-100 text-green-700',
};

function ReqBadge({ value }) {
  const cls = REQ_STATUS_STYLES[value] || 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-1 text-xs rounded-full capitalize ${cls}`}>{value}</span>;
}

export default function LoanRequests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ member_id: '', requested_amount: '', tenure_months: '', purpose: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/loan-requests'), api.get('/loan-requests/summary')])
      .then(([r, s]) => { setRequests(r.data.data); setSummary(s.data.data); })
      .catch(() => toast.error('Failed to load loan requests'))
      .finally(() => setLoading(false));
    if (isAdmin) {
      api.get('/members').then((res) => setMembers(res.data.data.filter((m) => m.is_active))).catch(() => {});
    }
  }, [isAdmin]);
  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        requested_amount: Number(form.requested_amount),
        tenure_months: form.tenure_months ? Number(form.tenure_months) : null,
        purpose: form.purpose,
      };
      if (isAdmin && form.member_id) body.member_id = Number(form.member_id);
      await api.post('/loan-requests', body);
      toast.success('Loan request submitted');
      setModal(false);
      setForm({ member_id: '', requested_amount: '', tenure_months: '', purpose: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    }
  };

  const act = async (fn, okMsg) => {
    try {
      const res = await fn();
      toast.success(res?.data?.message || okMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const revoke = (r) => {
    if (!window.confirm(`Revoke ${isAdmin ? r.member_name + "'s" : 'your'} request?`)) return;
    act(() => api.delete(`/loan-requests/${r.id}`), 'Request revoked');
  };
  const approve = (r) => act(() => api.patch(`/loan-requests/${r.id}/approve`), 'Approved');
  const reject = (r) => act(() => api.patch(`/loan-requests/${r.id}/reject`), 'Rejected');
  const allocate = () => {
    if (!window.confirm('Run allocation over the available fund now?')) return;
    act(() => api.post('/loan-requests/allocate'), 'Allocated');
  };
  const distribute = () => {
    if (!window.confirm('Distribute loans for all allocated requests? This creates real loans and disburses funds.')) return;
    act(() => api.post('/loan-requests/distribute'), 'Distributed');
  };

  if (loading) return <Spinner label="Loading loan requests..." />;

  const overFund = summary && summary.total_requested > summary.available_fund;
  const hasAllocated = requests.some((r) => r.status === 'allocated');

  return (
    <div>
      <PageTitle
        title="Loan Requests"
        action={
          <button onClick={() => setModal(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2">
            <FiPlus /> New Request
          </button>
        }
      />

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Available Fund" value={inr(summary.available_fund)} tone="green" />
          <Stat label="Total Requested (active)" value={inr(summary.total_requested)} tone={overFund ? 'red' : 'blue'} />
          <Stat label="Total Allocated" value={inr(summary.total_allocated)} tone="purple" />
          <Stat label="Request closes on" value={`Day ${summary.loan_request_day}`} tone="gray" />
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">
              {summary?.window_closed
                ? 'Request window is closed — you can approve/reject, allocate and distribute.'
                : `Request window is open until day ${summary?.loan_request_day}. Allocation/approval unlock after that.`}
            </span>
            <div className="ml-auto flex gap-2">
              <button onClick={allocate} disabled={!summary?.window_closed}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <FiPieChart /> Run Allocation
              </button>
              <button onClick={distribute} disabled={!hasAllocated}
                className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <FiSend /> Distribute Loans
              </button>
            </div>
          </div>
          {overFund && (
            <p className="text-xs text-red-600 mt-2">
              Requests ({inr(summary.total_requested)}) exceed the available fund ({inr(summary.available_fund)}). Allocation will be pro-rata by requested amount.
            </p>
          )}
        </Card>
      )}

      {/* Requests table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {isAdmin && <Th>Member</Th>}
                <Th>Requested</Th>
                <Th>Allocated</Th>
                <Th>Tenure</Th>
                <Th>Purpose</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => {
                const shortfall = r.status === 'allocated' && Number(r.allocated_amount) < Number(r.requested_amount);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    {isAdmin && <td className="px-6 py-3 font-medium">{r.member_name}</td>}
                    <td className="px-6 py-3">{inr(r.requested_amount)}</td>
                    <td className="px-6 py-3">
                      {['allocated', 'disbursed'].includes(r.status) ? (
                        <span className={shortfall ? 'text-red-600 font-medium' : 'font-medium'}>{inr(r.allocated_amount)}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{r.tenure_months ? `${r.tenure_months} mo` : '—'}</td>
                    <td className="px-6 py-3 text-gray-500 max-w-[180px] truncate">{r.purpose || '—'}</td>
                    <td className="px-6 py-3"><ReqBadge value={r.status} /></td>
                    <td className="px-6 py-3 text-sm text-gray-500">{fmtDate(r.created_at)}</td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        {isAdmin && r.status === 'pending' && (
                          <>
                            <button onClick={() => approve(r)} title="Approve" className="text-green-600 hover:text-green-700"><FiCheck /></button>
                            <button onClick={() => reject(r)} title="Reject" className="text-red-600 hover:text-red-700"><FiX /></button>
                          </>
                        )}
                        {isAdmin && ['approved', 'allocated'].includes(r.status) && (
                          <button onClick={() => reject(r)} title="Reject" className="text-red-600 hover:text-red-700"><FiX /></button>
                        )}
                        {['pending', 'approved', 'allocated'].includes(r.status) && (
                          <button onClick={() => revoke(r)} title="Revoke" className="text-gray-500 hover:text-red-600"><FiTrash2 /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-6 py-10 text-center text-gray-400">No loan requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {requests.some((r) => r.status === 'allocated' && Number(r.allocated_amount) < Number(r.requested_amount)) && (
        <p className="text-xs text-gray-500 mt-3">
          Amounts shown in red are less than requested (pro-rata). If a member doesn't want the reduced amount, they can revoke — the freed amount is redistributed to the remaining members.
        </p>
      )}

      {modal && (
        <Modal title="New Loan Request" onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            {isAdmin && (
              <Field label="Member *">
                <select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} className={inputClass}>
                  <option value="">Select member</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Requested Amount (₹) *">
              <input type="number" required min="1" value={form.requested_amount}
                onChange={(e) => setForm({ ...form, requested_amount: e.target.value })} className={inputClass} placeholder="50000" />
            </Field>
            <Field label="Tenure (months)">
              <input type="number" min="1" value={form.tenure_months}
                onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} className={inputClass} placeholder="e.g. 12" />
            </Field>
            <Field label="Purpose">
              <textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={inputClass} rows={2} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">Submit Request</button>
              <button type="button" onClick={() => setModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const cls = { green: 'bg-green-50', blue: 'bg-blue-50', purple: 'bg-purple-50', red: 'bg-red-50', gray: 'bg-gray-50' }[tone] || 'bg-gray-50';
  return (
    <Card className={`p-4 ${cls}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </Card>
  );
}

function Th({ children, className = '' }) {
  return <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>{children}</th>;
}
