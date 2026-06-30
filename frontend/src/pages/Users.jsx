import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiShield, FiKey, FiUserCheck } from 'react-icons/fi';
import api from '../lib/api';
import { fmtDate } from '../lib/format';
import { Card, PageTitle, Spinner, Badge, Modal, Field, inputClass } from '../components/ui';

// Super Admin is intentionally NOT assignable from the UI.
// Only the seeded super admin holds that role; others can be admin/subadmin/manager.
const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Sub Admin' },
  { value: 'manager', label: 'Manager' },
];

export default function Users() {
  const [tab, setTab] = useState('users');

  return (
    <div>
      <PageTitle title="Users & Permissions" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<FiUserCheck />}>
          App Users
        </TabButton>
        <TabButton active={tab === 'permissions'} onClick={() => setTab('permissions')} icon={<FiShield />}>
          Permissions
        </TabButton>
      </div>

      {tab === 'users' ? <UsersTab /> : <PermissionsTab />}
    </div>
  );
}

/* ---------------- App Users Tab (list only, no add) ---------------- */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'manager' });

  const load = () => {
    setLoading(true);
    api.get('/users')
      .then((res) => setUsers(res.data.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editing.id}`, form);
      toast.success('User updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <Spinner label="Loading users..." />;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr><Th>Name</Th><Th>Email</Th><Th>Login Role</Th><Th>Created</Th><Th className="text-right">Actions</Th></tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{u.name}</td>
                  <td className="px-6 py-4 text-gray-600">{u.email}</td>
                  <td className="px-6 py-4"><Badge value={u.role} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{fmtDate(u.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3 text-gray-500">
                      <button onClick={() => openEdit(u)} className="hover:text-yellow-600"><FiEdit2 /></button>
                      <button onClick={() => remove(u.id)} className="hover:text-red-600"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No users yet. Grant login access from the Permissions tab.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <Modal title="Edit User" onClose={() => setEditing(null)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name *">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Email *">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Login Role">
              {editing?.role === 'superadmin' ? (
                <div className="flex items-center gap-2">
                  <Badge value="superadmin" />
                  <span className="text-xs text-gray-400">Super Admin role can't be changed.</span>
                </div>
              ) : (
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">Update</button>
              <button type="button" onClick={() => setEditing(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------------- Permissions Tab (assign login roles to members) ---------------- */
function PermissionsTab() {
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(null); // member object
  const [form, setForm] = useState({ email: '', password: '', role: 'manager' });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/members'), api.get('/users')])
      .then(([mRes, uRes]) => {
        setMembers(mRes.data.data);
        setUsers(uRes.data.data);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Map a member to its login user (matched by email)
  const userForMember = (member) =>
    users.find((u) => member.email && u.email && u.email.toLowerCase() === member.email.toLowerCase());

  const openGrant = (member) => {
    setGranting(member);
    setForm({ email: member.email || '', password: '', role: 'manager' });
  };

  const submitGrant = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/grant-access', {
        member_id: granting.id,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      toast.success('Login access granted');
      setGranting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to grant access');
    }
  };

  const changeRole = async (user, role) => {
    try {
      await api.patch(`/users/${user.id}/role`, { role });
      toast.success('Role updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const revoke = async (user) => {
    if (!window.confirm('Revoke login access for this member?')) return;
    try {
      await api.delete(`/users/${user.id}/access`);
      toast.success('Login access revoked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke access');
    }
  };

  if (loading) return <Spinner label="Loading members..." />;

  return (
    <>
      <p className="text-sm text-gray-500 mb-4">
        Assign a login role to a committee member. This is the app login role, separate from their committee role.
      </p>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <Th>Member</Th>
                <Th>Committee Role</Th>
                <Th>Login Access</Th>
                <Th>Login Role</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => {
                const user = userForMember(m);
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-gray-400">{m.email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-4"><Badge value={m.committee_role} /></td>
                    <td className="px-6 py-4">
                      {user
                        ? <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium"><FiUserCheck /> Active</span>
                        : <span className="text-gray-400 text-sm">No login</span>}
                    </td>
                    <td className="px-6 py-4">
                      {user ? (
                        user.role === 'superadmin' ? (
                          <Badge value="superadmin" />
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => changeRole(user, e.target.value)}
                            className={`${inputClass} py-1 text-sm`}
                          >
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {user ? (
                          user.role === 'superadmin' ? (
                            <span className="text-xs text-gray-400">Protected</span>
                          ) : (
                            <button
                              onClick={() => revoke(user)}
                              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm border border-red-200 px-3 py-1 rounded-lg"
                            >
                              <FiTrash2 /> Revoke
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => openGrant(m)}
                            className="inline-flex items-center gap-1 bg-brand-600 text-white hover:bg-brand-700 text-sm px-3 py-1 rounded-lg"
                          >
                            <FiKey /> Grant Access
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {granting && (
        <Modal title={`Grant Login Access - ${granting.name}`} onClose={() => setGranting(null)}>
          <form onSubmit={submitGrant} className="space-y-3">
            <Field label="Login Email *">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Password *">
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Login Role">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">Grant Access</button>
              <button type="button" onClick={() => setGranting(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
        active ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon} {children}
    </button>
  );
}

function Th({ children, className = '' }) {
  return <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>{children}</th>;
}
