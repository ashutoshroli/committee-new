import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Loans from './pages/Loans';
import CreateLoan from './pages/CreateLoan';
import LoanDetail from './pages/LoanDetail';
import Instalments from './pages/Instalments';
import Settings from './pages/Settings';
import Users from './pages/Users';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Loading...</div>;
  }
  return user ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user && (user.role === 'superadmin' || user.role === 'admin')) return children;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="members" element={<Members />} />
            <Route path="members/:id" element={<MemberDetail />} />
            <Route path="loans" element={<Loans />} />
            <Route path="loans/create" element={<CreateLoan />} />
            <Route path="loans/:id" element={<LoanDetail />} />
            <Route path="instalments" element={<Instalments />} />
            <Route path="settings" element={<Settings />} />
            <Route path="users" element={<AdminOnly><Users /></AdminOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
