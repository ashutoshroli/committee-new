import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';
import api from '../lib/api';
import { Card, PageTitle, Spinner, Badge, Modal, Field, inputClass } from '../components/ui';

const EMPTY = { name: '', phone: '', email: '', address: '', committee_role: 'member' };

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => {
    setLoading(true);
    api.get('/members')
      .then((res) => setMembers(res.data.data))
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, phone: m.phone || '', email: m.email || '', address: m.address || '', committee_role: m.committee_role });
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/members/${editing.id}`, form);
        toast.success('Member updated');
      } else {
        await api.post('/members', form);
        toast.success('Member added');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this member?')) return;
    try {
      await api.delete(`/members/${id}`);
      toast.success('Member deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <Spinner label="Loading members..." />;

  return (
    <div>
      <PageTitle
        title="Members"
        action={
          <button onClick={openAdd} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2">
            <FiPlus /> Add Member
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <Th>Name</Th><Th>Phone</Th><Th>Role</Th><Th>Status</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{m.name}</p>
                    <p className="text-sm text-gray-500">{m.email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{m.phone || '-'}</td>
                  <td className="px-6 py-4"><Badge value={m.committee_role} /></td>
                  <td className="px-6 py-4">
                    <Badge value={m.is_active ? 'active' : 'unpaid'} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3 text-gray-500">
                      <Link to={`/members/${m.id}`} className="hover:text-blue-600"><FiEye /></Link>
                      <button onClick={() => openEdit(m)} className="hover:text-yellow-600"><FiEdit2 /></button>
                      <button onClick={() => remove(m.id)} className="hover:text-red-600"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length === 0 && <p className="text-center py-8 text-gray-500">No members yet. Add your first member.</p>}
      </Card>

      {modal && (
        <Modal title={editing ? 'Edit Member' : 'Add Member'} onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name *">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Address">
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} rows={2} />
            </Field>
            <Field label="Committee Role">
              <select value={form.committee_role} onChange={(e) => setForm({ ...form, committee_role: e.target.value })} className={inputClass}>
                <option value="member">Member</option>
                <option value="president">President</option>
                <option value="secretary">Secretary</option>
                <option value="treasurer">Treasurer</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700">
                {editing ? 'Update' : 'Add'}
              </button>
              <button type="button" onClick={() => setModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                Cancel
              </button>
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
