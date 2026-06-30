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
            <Field label="Payment Due Day (1-28)">
              <input type="number" min="1" max="28" value={form.payment_due_day || ''} onChange={set('payment_due_day')} className={inputClass} />
            </Field>
          </div>
          <button type="submit" disabled={saving} className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </Card>
    </div>
  );
}
