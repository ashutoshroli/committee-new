import { useState, useEffect } from 'react';
import { FiUsers, FiDollarSign, FiTrendingUp, FiPercent } from 'react-icons/fi';
import api from '../lib/api';
import { inr, MONTHS } from '../lib/format';
import { Card, Spinner, Empty } from '../components/ui';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (!stats) return <Empty>Could not load dashboard. Is the backend running?</Empty>;

  const cards = [
    { title: 'Active Members', value: stats.members.active, sub: `${stats.members.total} total`, icon: FiUsers, color: 'bg-blue-500' },
    { title: 'Available Fund', value: inr(stats.fund.available), sub: `In ${inr(stats.fund.total_in)} / Out ${inr(stats.fund.total_out)}`, icon: FiDollarSign, color: 'bg-green-500' },
    { title: 'Active Loans', value: stats.loans.active_count, sub: `Outstanding ${inr(stats.loans.total_outstanding)}`, icon: FiTrendingUp, color: 'bg-orange-500' },
    { title: 'Interest Earned', value: inr(stats.total_interest_earned), sub: 'From all loans', icon: FiPercent, color: 'bg-purple-500' },
  ];

  const c = stats.current_month_collection;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((card) => (
          <Card key={card.title} className="p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1 truncate">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1 truncate">{card.sub}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg shrink-0`}>
                <card.icon className="text-white" size={22} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Collection — {MONTHS[c.month - 1]} {c.year}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Collected" value={inr(c.collected)} />
          <Stat label="Expected" value={inr(c.expected)} />
          <Stat label="Paid" value={c.paid} tone="green" />
          <Stat label="Unpaid" value={c.unpaid} tone="red" />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const toneCls = tone === 'green' ? 'text-green-600 bg-green-50'
    : tone === 'red' ? 'text-red-600 bg-red-50' : 'text-gray-800 bg-gray-50';
  return (
    <div className={`text-center p-4 rounded-lg ${toneCls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
