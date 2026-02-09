import { useState, useEffect, FormEvent } from 'react';
import { templeApi } from '../services/api';

interface Temple {
  id: string;
  name: string;
  deity: string;
  city: string;
  state: string;
  address: string;
  phone?: string;
  isActive: boolean;
  hasWheelchairAccess: boolean;
  parkingCapacity: number;
}

interface Props {
  token: string;
  isAdmin: boolean;
}

export default function TemplesPage({ token, isAdmin }: Props) {
  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', deity: '', address: '', city: '', state: '', pincode: '', phone: '' });

  const fetchTemples = async () => {
    try {
      const res = await templeApi.list() as { data: Temple[] };
      setTemples(res.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchTemples(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await templeApi.create(token, form);
      setShowForm(false);
      setForm({ name: '', deity: '', address: '', city: '', state: '', pincode: '', phone: '' });
      fetchTemples();
    } catch { /* ignore */ }
  };

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  if (loading) return <div>Loading temples...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Temples</h1>
        {isAdmin && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Temple</button>}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Register New Temple</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Temple Name</label>
                <input className="form-control" value={form.name} onChange={e => update('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Primary Deity</label>
                <input className="form-control" value={form.deity} onChange={e => update('deity', e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input className="form-control" value={form.address} onChange={e => update('address', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input className="form-control" value={form.city} onChange={e => update('city', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>State</label>
                <input className="form-control" value={form.state} onChange={e => update('state', e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Pincode</label>
                <input className="form-control" value={form.pincode} onChange={e => update('pincode', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={form.phone} onChange={e => update('phone', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">Save Temple</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-grid">
        {temples.map(temple => (
          <div key={temple.id} className="card">
            <h3 style={{ marginBottom: 4 }}>{temple.name}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Deity: {temple.deity}</p>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <div>{temple.address}</div>
              <div>{temple.city}, {temple.state}</div>
              {temple.phone && <div style={{ marginTop: 4 }}>Phone: {temple.phone}</div>}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {temple.isActive && <span className="badge badge-success">Active</span>}
              {temple.hasWheelchairAccess && <span className="badge badge-info">Wheelchair Access</span>}
              {temple.parkingCapacity > 0 && <span className="badge badge-secondary">Parking: {temple.parkingCapacity}</span>}
            </div>
          </div>
        ))}
        {temples.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No temples registered yet.</p>}
      </div>
    </div>
  );
}
