import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FiActivity, FiRefreshCw } from 'react-icons/fi';
import api from '../lib/api';
import { Card, PageTitle, Spinner, Badge, inputClass } from '../components/ui';

const ACTION_STYLES = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-yellow-100 text-yellow-700',
  delete: 'bg-red-100 text-red-700',
  payment: 'bg-blue-100 text-blue-700',
  foreclose: 'bg-purple-100 text-purple-700',
  generate: 'bg-teal-100 text-teal-700',
  login: 'bg-gray-100 text-gray-700',
  grant_access: 'bg-green-100 text-green-700',
  revoke_access: 'bg-red-100 text-red-700',
};

const ENTITIES = ['', 'loan', 'member', 'user', 'instalment', 'settings', 'auth'];
const ACTIONS = ['', 'create', 'update', 'delete', 'payment', 'foreclose', 'generate', 'login', 'grant_access', 'revoke_access'];

function fmtDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 200 };
    if (entityType) params.entity_type = entityType;
    if (action) params.action = action;
    api.get('/activity-logs', { params })
      .then((res) => {
        setLogs(res.data.data);
        setTotal(res.data.total);
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load activity log'))
      .finally(() => setLoading(false));
  }, [entityType, action]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageTitle
        title="Activity Log"
        action={
          <button onClick={load} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm">
            <FiRefreshCw /> Refresh
          </button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={`${inputClass} py-1.5`}>
              {ENTITIES.map((e) => <option key={e} value={e}>{e ? e[0].toUpperCase() + e.slice(1) : 'All entities'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={`${inputClass} py-1.5`}>
              {ACTIONS.map((a) => <option key={a} value={a}>{a ? a.replace('_', ' ') : 'All actions'}</option>)}
            </select>
          </div>
          <div className="ml-auto text-sm text-gray-500 self-center">{total} total events</div>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Loading activity log..." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Th>When</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                    <td className="px-6 py-3">
                      <div className="text-sm font-medium">{log.user_name || 'System'}</div>
                      {log.user_role && <div className="text-xs"><Badge value={log.user_role} /></div>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-700'}`}>
                        {String(log.action).replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm capitalize text-gray-600">{log.entity_type}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{log.description}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    <FiActivity className="inline mb-1" size={20} /><br />No activity recorded yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</th>;
}
