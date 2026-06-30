import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome, FiUsers, FiDollarSign, FiCalendar, FiSettings, FiUserCheck, FiLogOut, FiMenu, FiX,
} from 'react-icons/fi';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: FiHome, label: 'Dashboard', end: true },
    { to: '/members', icon: FiUsers, label: 'Members' },
    { to: '/loans', icon: FiDollarSign, label: 'Loans' },
    { to: '/instalments', icon: FiCalendar, label: 'Instalments' },
    { to: '/settings', icon: FiSettings, label: 'Settings' },
  ];
  if (user?.role === 'superadmin' || user?.role === 'admin') {
    navItems.push({ to: '/users', icon: FiUserCheck, label: 'Users' });
  }

  const SidebarContent = (
    <>
      <div className="p-5 border-b border-brand-700">
        <h1 className="text-lg font-bold">Committee Mgmt</h1>
        <p className="text-brand-100 text-sm mt-1 truncate">{user?.name}</p>
        <span className="text-xs bg-brand-700 px-2 py-0.5 rounded mt-1 inline-block capitalize">{user?.role}</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-800'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-brand-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-brand-100 hover:bg-brand-800 w-full transition"
        >
          <FiLogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-brand-900 text-white flex-col">{SidebarContent}</aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-brand-900 text-white flex flex-col">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 bg-white border-b px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-gray-700"><FiMenu size={22} /></button>
          <span className="font-semibold">Committee Mgmt</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
