import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';
import api from '../lib/api';
import { inr } from '../lib/format';
import { Card, Field, inputClass } from '../components/ui';

const EMPTY = {
  member_id: '', principal_amount: '', interest_rate: '',
  monthly_payment_amount: '', tenure_months: '', start_date: new Date().toISOString().split('T')[0], remarks: '',
};

export default function CreateLoan() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/members')
      .then((res) => setMembers(res.data.data.filter((m) => m.is_active)))
      .catch(() => {});
  }, []);

  const fetchPreview = useCallback(async () => {
    const { principal_amount, interest_rate, monthly_payment_amount } = form;
    if (!principal_amount || !interest_rate || !monthly_payment_amount) {
      setPreview(null);
      return;
    }
    try {
      const res = await api.post('/loans/preview', {
        principal_amount: Number(principal_amount),
        interest_rate: Number(interest_rate),
        monthly_payment_amount: Number(monthly_payment_amount),
      });
      setPreview(res.data.data);
    } catch {
      setPreview(null);
    }
  }, [form.principal_amount, form.interest_rate, form.monthly_payment_amount]);

  useEffect(() => {
    const t = setTimeout(fetchPreview, 400);
    return () => clearTimeout(t);
  }, [fetchPreview]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/loans', {
        ...form,
        member_id: Number(form.member_id),
        principal_amount: Number(form.principal_amount),
        interest_rate: Number(form.interest_rate),
        monthly_payment_amount: Number(form.monthly_payment_amount),
        tenure_months: form.tenure_months ? Number(form.tenure_months) : null,
      });
      toast.success('Loan created!');
      navigate(`/loans/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create loan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button onClick={() => navigate('/loans')} className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-800 mb-4">
        <FiArrowLeft /> Back to Loans
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Create New Loan</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Member *">
              <select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} className={inputClass}>
                <option value="">Select member</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name} {m.phone ? `(${m.phone})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Loan Amount (₹) *">
              <input type="number" required min="1" value={form.principal_amount}
                onChange={(e) => setForm({ ...form, principal_amount: e.target.value })} className={inputClass} placeholder="100000" />
            </Field>
            <Field label="Monthly Interest Rate (%) *">
              <input type="number" required min="0.01" step="0.01" value={form.interest_rate}
                onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} className={inputClass} placeholder="2" />
            </Field>
            <Field label="Monthly Payment Amount (₹) *">
              <input type="number" required min="1" value={form.monthly_payment_amount}
                onChange={(e) => setForm({ ...form, monthly_payment_amount: e.target.value })} className={inputClass} placeholder="10000" />
            </Field>
            <Field label="Tenure (months) — optional">
              <input type="number" min="1" value={form.tenure_months}
                onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} className={inputClass} placeholder="Leave empty for open-ended" />
            </Field>
            <Field label="Start Date">
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Remarks">
              <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputClass} rows={2} />
            </Field>
            <button type="submit" disabled={submitting} className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium">
              {submitting ? 'Creating...' : 'Create Loan'}
            </button>
          </form>
        </Card>

        <Card className="p-6 h-fit">
          <h2 className="text-lg font-semibold mb-4">Preview</h2>
          {!preview ? (
            <p className="text-gray-500 text-center py-10">Fill amount, rate & monthly payment to see the projection.</p>
          ) : (
            <div className="space-y-4">
              {preview.warning && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{preview.warning}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Box label="1st Month Interest" value={inr(preview.first_month_interest)} />
                <Box label="1st Month Principal" value={inr(preview.first_month_principal)} />
              </div>
              {preview.estimated_tenure_months != null && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Box label="Estimated Tenure" value={`${preview.estimated_tenure_months} mo`} tone="blue" />
                    <Box label="Total Interest" value={inr(preview.total_interest)} tone="green" />
                  </div>
                  <Box label="Total Payable" value={inr(preview.total_payable)} tone="purple" big />
                </>
              )}
              <p className="text-xs text-gray-400">
                Projection assumes the fixed monthly amount is paid every month. Partial payments or compounding may change actual figures.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Box({ label, value, tone, big }) {
  const cls = { blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50' }[tone] || 'bg-gray-50';
  return (
    <div className={`p-3 rounded-lg ${cls}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold ${big ? 'text-xl' : 'text-lg'}`}>{value}</p>
    </div>
  );
}
