import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import api from '../lib/api';
import { fmtDate } from '../lib/format';
import { Card, PageTitle, Spinner, Badge, Modal, Field, inputClass } from '../components/ui';

const EMPTY = { name: '', email: '', password: '', phone: '', role: 'manager' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => {
    setLoading(true);
    api.get('/users')
      .then((res) => setUsers(res.data.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role });
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, { name: form.name, email: form.email, phone: form.phone, role: form.role });
        toast.success('User updated');
      } else {
        await api.post('/users', form);
        toast.success('User created');
      }
      setModal(false);
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
    <div>
      <PageTitle
        title="App Users"
        action={
          <button onClick={openAdd} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2">
            <FiPlus /> Add User
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Created</Th><Th className="text-right">Actions</Th></tr>
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
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <Modal title={editing ? 'Edit User' : 'Add User'} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name *">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Email *">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </Field>
            {!editing && (
              <Field label="Password *">
                <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
              </Field>
            )}
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                <option value="superadmin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="subadmin">Sub Admin</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">{editing ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => setModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Th({ children, className = '' }) {
  return <th className={`text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>{children}</th>;
}
