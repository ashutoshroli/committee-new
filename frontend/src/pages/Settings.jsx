import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Card, Spinner, Field, inputClass } from '../components/ui';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then((res) => setForm(res.data.data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', {
        name: form.name,
        description: form.description,
        monthly_instalment: Number(form.monthly_instalment),
        default_interest_rate: Number(form.default_interest_rate),
        late_fine_per_day: Number(form.late_fine_per_day || 0),
        late_fine_per_month: Number(form.late_fine_per_month || 0),
        grace_period_days: Number(form.grace_period_days || 0),
        payment_due_day: Number(form.payment_due_day || 5),
        loan_instalment_due_day: Number(form.loan_instalment_due_day || 5),
        loan_request_from: form.loan_request_from ? String(form.loan_request_from).slice(0, 10) : null,
        loan_request_to: form.loan_request_to ? String(form.loan_request_to).slice(0, 10) : null,
        enforce_fund_limit: !!form.enforce_fund_limit,
        allow_advance_emi: !!form.allow_advance_emi,
        compound_unpaid_interest: !!form.compound_unpaid_interest,
        allow_foreclosure: !!form.allow_foreclosure,
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <Spinner label="Loading settings..." />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (k) => () => setForm({ ...form, [k]: !form[k] });
  const dateVal = (k) => (form[k] ? String(form[k]).slice(0, 10) : '');

  const LOAN_RULES = [
    { key: 'enforce_fund_limit', label: 'Enforce available-fund limit', desc: 'A loan (or increase) cannot exceed the committee\u2019s available fund.' },
    { key: 'allow_advance_emi', label: 'Allow advance EMI', desc: 'Extra amount paid rolls over to the next month(s). If off, a month\u2019s payments cannot exceed that month\u2019s EMI.' },
    { key: 'compound_unpaid_interest', label: 'Compound unpaid interest', desc: 'Unpaid monthly interest is added to the principal when monthly interest is processed.' },
    { key: 'allow_foreclosure', label: 'Allow foreclosure', desc: 'Loans can be closed early by paying the remaining principal plus current interest.' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Committee Settings</h1>
      <Card className="p-6 max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <Field label="Committee Name">
            <input value={form.name || ''} onChange={set('name')} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea value={form.description || ''} onChange={set('description')} className={inputClass} rows={2} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Monthly Instalment (₹)">
              <input type="number" min="0" value={form.monthly_instalment || ''} onChange={set('monthly_instalment')} className={inputClass} />
            </Field>
            <Field label="Default Interest Rate (%/month)">
              <input type="number" min="0" step="0.01" value={form.default_interest_rate || ''} onChange={set('default_interest_rate')} className={inputClass} />
            </Field>
            <Field label="Late Fine (₹/day)">
              <input type="number" min="0" value={form.late_fine_per_day || ''} onChange={set('late_fine_per_day')} className={inputClass} />
            </Field>
            <Field label="Late Fine (₹/month)">
              <input type="number" min="0" value={form.late_fine_per_month || ''} onChange={set('late_fine_per_month')} className={inputClass} />
            </Field>
            <Field label="Grace Period (days)">
              <input type="number" min="0" value={form.grace_period_days || ''} onChange={set('grace_period_days')} className={inputClass} />
            </Field>
            <Field label="Regular Instalment Due Day (1-28)">
              <input type="number" min="1" max="28" value={form.payment_due_day || ''} onChange={set('payment_due_day')} className={inputClass} />
            </Field>
            <Field label="Loan Instalment (EMI) Due Day (1-28)">
              <input type="number" min="1" max="28" value={form.loan_instalment_due_day || ''} onChange={set('loan_instalment_due_day')} className={inputClass} />
            </Field>
          </div>

          <div className="pt-2">
            <h2 className="text-lg font-semibold text-gray-800">Loan Request Window</h2>
            <p className="text-sm text-gray-500 mb-3">Members can submit loan requests only between these dates. After the "to" date, admins can review, allocate and distribute.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Requests Open From">
                <input type="date" value={dateVal('loan_request_from')} onChange={set('loan_request_from')} className={inputClass} />
              </Field>
              <Field label="Requests Open To">
                <input type="date" value={dateVal('loan_request_to')} onChange={set('loan_request_to')} className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="pt-2">
            <h2 className="text-lg font-semibold text-gray-800">Loan Rules</h2>
            <p className="text-sm text-gray-500 mb-3">Turn individual loan rules on or off. Changes apply to new actions.</p>
            <div className="space-y-2">
              {LOAN_RULES.map((r) => (
                <label key={r.key} htmlFor={r.key} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <button
                    type="button"
                    id={r.key}
                    role="switch"
                    aria-checked={!!form[r.key]}
                    onClick={toggle(r.key)}
                    className={`mt-0.5 relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${form[r.key] ? 'bg-brand-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form[r.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span>
                    <span className="block font-medium text-gray-800">{r.label}</span>
                    <span className="block text-xs text-gray-500">{r.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </Card>
    </div>
  );
}
