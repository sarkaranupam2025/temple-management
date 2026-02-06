import { useState, useEffect } from 'react';
import { volunteerApi } from '../services/api';

interface VolunteerEntry {
  id: string;
  totalHours: number;
  totalPoints: number;
  tier: string;
  user: { firstName: string; lastName: string; email: string };
}

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  task: string;
  status: string;
  location?: string;
}

interface Props { token: string; }

const tierColors: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700', platinum: '#e5e4e2',
};

export default function VolunteersPage({ token }: Props) {
  const [leaderboard, setLeaderboard] = useState<VolunteerEntry[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lbRes, shiftRes] = await Promise.all([
          volunteerApi.getLeaderboard() as Promise<{ data: VolunteerEntry[] }>,
          volunteerApi.getShifts(token) as Promise<{ data: Shift[] }>,
        ]);
        setLeaderboard(lbRes.data || []);
        setShifts(shiftRes.data || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  if (loading) return <div>Loading volunteers...</div>;

  return (
    <div>
      <div className="page-header"><h1>Volunteers</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Leaderboard</h3></div>
          {leaderboard.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No volunteers yet.</p>
          ) : (
            <div>
              {leaderboard.slice(0, 10).map((v, i) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-muted)', width: 24 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{v.user.firstName} {v.user.lastName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.totalHours}h logged</div>
                  </div>
                  <span style={{ fontWeight: 700 }}>{v.totalPoints} pts</span>
                  <span className="badge" style={{ background: tierColors[v.tier] || '#e2e3e5', color: '#333' }}>{v.tier}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>My Shifts</h3></div>
          {shifts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No shifts assigned.</p>
          ) : (
            <div>
              {shifts.map(s => (
                <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{s.task}</span>
                    <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'scheduled' ? 'badge-info' : 'badge-warning'}`}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {new Date(s.date).toLocaleDateString('en-IN')} | {s.startTime} - {s.endTime}
                    {s.location && ` | ${s.location}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
