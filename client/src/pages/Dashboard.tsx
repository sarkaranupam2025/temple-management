import { useState, useEffect } from 'react';

interface Props {
  token: string;
  isAdmin: boolean;
}

interface DashboardData {
  totalTemples: number;
  totalBookings: number;
  totalDonations: number;
  donationAmount: number;
  activeVolunteers: number;
  pendingBookings: number;
}

export default function Dashboard({ token, isAdmin }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };
        const [temples, bookings, donations] = await Promise.all([
          fetch('/api/temples', { headers }).then(r => r.json()),
          fetch('/api/bookings', { headers }).then(r => r.json()),
          fetch('/api/donations', { headers }).then(r => r.json()),
        ]);

        const templeList = temples.data || [];
        const bookingList = bookings.data || [];
        const donationList = donations.data || [];

        setData({
          totalTemples: Array.isArray(templeList) ? templeList.length : 0,
          totalBookings: Array.isArray(bookingList) ? bookingList.length : 0,
          totalDonations: Array.isArray(donationList) ? donationList.length : 0,
          donationAmount: Array.isArray(donationList) ? donationList.reduce((sum: number, d: { amount?: number }) => sum + (d.amount || 0), 0) : 0,
          activeVolunteers: 0,
          pendingBookings: Array.isArray(bookingList) ? bookingList.filter((b: { status: string }) => b.status === 'PENDING').length : 0,
        });
      } catch {
        setData({ totalTemples: 0, totalBookings: 0, totalDonations: 0, donationAmount: 0, activeVolunteers: 0, pendingBookings: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Temples</div>
          <div className="stat-value">{data?.totalTemples || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Bookings</div>
          <div className="stat-value">{data?.totalBookings || 0}</div>
          <div className="stat-change">{data?.pendingBookings || 0} pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Donations Received</div>
          <div className="stat-value">{data?.totalDonations || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Collection</div>
          <div className="stat-value">₹{(data?.donationAmount || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>Quick Actions</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <a href="/bookings" className="btn btn-primary" style={{ justifyContent: 'center' }}>New Booking</a>
            <a href="/donations" className="btn btn-secondary" style={{ justifyContent: 'center' }}>Make Donation</a>
            <a href="/prasad" className="btn btn-secondary" style={{ justifyContent: 'center' }}>Order Prasad</a>
            <a href="/communication" className="btn btn-secondary" style={{ justifyContent: 'center' }}>Announcements</a>
          </div>
        </div>

        {isAdmin && (
          <div className="card">
            <div className="card-header"><h3>System Overview</h3></div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>Active Volunteers</span><span style={{ fontWeight: 600 }}>{data?.activeVolunteers || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>Pending Bookings</span><span style={{ fontWeight: 600 }}>{data?.pendingBookings || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span>System Status</span><span className="badge badge-success">Operational</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
