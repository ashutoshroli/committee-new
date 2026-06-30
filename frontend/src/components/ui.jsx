// Small reusable UI primitives

export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

export function PageTitle({ title, action }) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading...' }) {
  return <div className="text-center py-10 text-gray-500">{label}</div>;
}

export function Empty({ children }) {
  return <div className="text-center py-10 text-gray-500">{children}</div>;
}

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  unpaid: 'bg-gray-100 text-gray-700',
  late: 'bg-red-100 text-red-700',
  active: 'bg-orange-100 text-orange-700',
  closed: 'bg-green-100 text-green-700',
  foreclosed: 'bg-blue-100 text-blue-700',
  superadmin: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  subadmin: 'bg-blue-100 text-blue-700',
  manager: 'bg-gray-100 text-gray-700',
  emi: 'bg-green-100 text-green-700',
  interest_only: 'bg-yellow-100 text-yellow-700',
};

export function Badge({ value }) {
  const cls = STATUS_STYLES[value] || 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-1 text-xs rounded-full capitalize ${cls}`}>{String(value).replace('_', ' ')}</span>;
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none';
