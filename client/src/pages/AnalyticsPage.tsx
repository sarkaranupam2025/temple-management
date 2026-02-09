import { useState, useEffect } from 'react';

interface Props { token: string; }

interface DashboardData {
  todayVisitors: number;
  todayBookings: number;
  todayDonationAmount: number;
  todayDonationCount: number;
  pendingBookings: number;
  openFeedback: number;
  yesterdayVisitors: number;
  yesterdayDonationAmount: number;
}

interface FeedbackEntry {
  id: string;
  category: string;
  rating: number;
  comment?: string;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

export default function AnalyticsPage({ token }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const [fbRes] = await Promise.all([
          fetch('/api/analytics/feedback?page=1&limit=20', { headers }).then(r => r.json()),
        ]);
        setFeedback(fbRes.data || []);
        setData({
          todayVisitors: 0, todayBookings: 0, todayDonationAmount: 0,
          todayDonationCount: 0, pendingBookings: 0, openFeedback: (fbRes.data || []).filter((f: FeedbackEntry) => f.status === 'open').length,
          yesterdayVisitors: 0, yesterdayDonationAmount: 0,
        });
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div>
      <div className="page-header"><h1>Analytics & Reports</h1></div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today's Bookings</div>
          <div className="stat-value">{data?.todayBookings || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today's Donations</div>
          <div className="stat-value">₹{(data?.todayDonationAmount || 0).toLocaleString('en-IN')}</div>
          <div className="stat-change">{data?.todayDonationCount || 0} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Bookings</div>
          <div className="stat-value">{data?.pendingBookings || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Feedback</div>
          <div className="stat-value">{data?.openFeedback || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Recent Feedback</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>User</th><th>Category</th><th>Rating</th><th>Comment</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {feedback.map(f => (
                <tr key={f.id}>
                  <td>{f.user?.firstName} {f.user?.lastName}</td>
                  <td>{f.category}</td>
                  <td>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.comment || '-'}</td>
                  <td><span className={`badge ${f.status === 'open' ? 'badge-warning' : f.status === 'resolved' ? 'badge-success' : 'badge-info'}`}>{f.status}</span></td>
                  <td>{new Date(f.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
              {feedback.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No feedback yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
