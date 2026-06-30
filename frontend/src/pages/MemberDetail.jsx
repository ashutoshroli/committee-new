import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import api from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { Card, Spinner, Empty, Badge } from '../components/ui';

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/members/${id}`)
      .then((res) => setMember(res.data.data))
      .catch(() => setMember(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!member) return <Empty>Member not found</Empty>;

  return (
    <div>
      <Link to="/members" className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-800 mb-4">
        <FiArrowLeft /> Back to Members
      </Link>

      <Card className="p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{member.name}</h1>
            <div className="mt-2"><Badge value={member.committee_role} /></div>
          </div>
          <Badge value={member.is_active ? 'active' : 'unpaid'} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <Info label="Phone" value={member.phone || '-'} />
          <Info label="Email" value={member.email || '-'} />
          <Info label="Join Date" value={fmtDate(member.join_date)} />
          <Info label="Address" value={member.address || '-'} />
        </div>
      </Card>

      {member.loans?.length > 0 && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Loans</h2>
          <div className="space-y-3">
            {member.loans.map((loan) => (
              <Link key={loan.id} to={`/loans/${loan.id}`} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div>
                  <p className="font-medium">{inr(loan.principal_amount)}</p>
                  <p className="text-sm text-gray-500">{loan.interest_rate}%/mo · EMI {inr(loan.monthly_payment_amount)}</p>
                </div>
                <div className="text-right">
                  <Badge value={loan.status} />
                  <p className="text-sm text-gray-500 mt-1">Remaining {inr(loan.remaining_principal)}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {member.instalment_summary?.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Instalment Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {member.instalment_summary.map((s) => (
              <div key={s.status} className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-lg font-bold capitalize">{s.status}</p>
                <p className="text-sm text-gray-500">{s.count} month(s)</p>
                <p className="text-xs text-gray-400">{inr(s.total_paid)} paid</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
