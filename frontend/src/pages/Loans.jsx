import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiEye } from 'react-icons/fi';
import api from '../lib/api';
import { inr } from '../lib/format';
import { Card, PageTitle, Spinner, Empty, Badge } from '../components/ui';

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/loans')
      .then((res) => setLoans(res.data.data))
      .catch(() => toast.error('Failed to load loans'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading loans..." />;

  return (
    <div>
      <PageTitle
        title="Loans"
        action={
          <Link to="/loans/create" className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2">
            <FiPlus /> New Loan
          </Link>
        }
      />

      {loans.length === 0 ? (
        <Empty>No loans yet. Create one.</Empty>
      ) : (
        <div className="grid gap-4">
          {loans.map((loan) => {
            const paidPct = Math.min(100, (Number(loan.total_principal_paid) / Number(loan.principal_amount)) * 100 || 0);
            return (
              <Card key={loan.id} className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{loan.member_name}</h3>
                    <p className="text-sm text-gray-500">{loan.member_phone}</p>
                  </div>
                  <Badge value={loan.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                  <Cell label="Principal" value={inr(loan.principal_amount)} />
                  <Cell label="Remaining" value={inr(loan.remaining_principal)} red />
                  <Cell label="Rate" value={`${loan.interest_rate}%/mo`} />
                  <Cell label="Monthly" value={inr(loan.monthly_payment_amount)} />
                  <div className="flex items-end">
                    <Link to={`/loans/${loan.id}`} className="text-brand-600 hover:text-brand-800 flex items-center gap-1 text-sm">
                      <FiEye size={14} /> Details
                    </Link>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Paid {inr(loan.total_principal_paid)}</span>
                    <span>{paidPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-brand-600 h-2 rounded-full" style={{ width: `${paidPct}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, red }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-medium ${red ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}
