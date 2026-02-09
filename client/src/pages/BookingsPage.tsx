import { useState, useEffect } from 'react';
import { bookingApi } from '../services/api';

interface Booking {
  id: string;
  bookingNumber: string;
  date: string;
  numberOfPersons: number;
  status: string;
  totalAmount: number;
  specialRequests?: string;
  slot?: { startTime: string; endTime: string; slotType: string };
  ritual?: { name: string };
  createdAt: string;
}

interface Props { token: string; }

const statusColors: Record<string, string> = {
  PENDING: 'badge-warning', CONFIRMED: 'badge-info', CHECKED_IN: 'badge-success',
  COMPLETED: 'badge-success', CANCELLED: 'badge-danger', NO_SHOW: 'badge-secondary',
};

export default function BookingsPage({ token }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const res = await bookingApi.list(token) as { data: Booking[] };
      setBookings(res.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, [token]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await bookingApi.cancel(token, id, 'Cancelled by user');
      fetchBookings();
    } catch { /* ignore */ }
  };

  if (loading) return <div>Loading bookings...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Bookings</h1>
      </div>

      {bookings.length === 0 ? (
        <div className="card"><p style={{ color: 'var(--text-muted)' }}>No bookings found. Visit a temple page to create a booking.</p></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Date</th>
                <th>Time Slot</th>
                <th>Ritual</th>
                <th>Persons</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{b.bookingNumber}</td>
                  <td>{new Date(b.date).toLocaleDateString('en-IN')}</td>
                  <td>{b.slot ? `${b.slot.startTime} - ${b.slot.endTime}` : '-'}</td>
                  <td>{b.ritual?.name || '-'}</td>
                  <td>{b.numberOfPersons}</td>
                  <td>₹{b.totalAmount.toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${statusColors[b.status] || 'badge-secondary'}`}>{b.status}</span></td>
                  <td>
                    {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
