import { useState, useEffect, FormEvent } from 'react';
import { donationApi, templeApi } from '../services/api';

interface Donation {
  id: string;
  donationNumber: string;
  amount: number;
  category: string;
  purpose?: string;
  paymentMethod: string;
  paymentStatus: string;
  is80GEligible: boolean;
  receiptGenerated: boolean;
  createdAt: string;
}

interface Temple { id: string; name: string; }
interface Props { token: string; }

const categories = [
  'GENERAL_FUND', 'SPECIFIC_PROJECT', 'SEVA_ACTIVITY', 'FESTIVAL_SPONSORSHIP',
  'PRIEST_WELFARE', 'ANNADANAM', 'BUILDING_REPAIR', 'EDUCATION', 'MEDICAL_CAMP',
];

export default function DonationsPage({ token }: Props) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ templeId: '', amount: '', category: 'GENERAL_FUND', purpose: '', paymentMethod: 'UPI', donorPan: '' });

  const fetchData = async () => {
    try {
      const [dRes, tRes] = await Promise.all([
        donationApi.list(token) as Promise<{ data: Donation[] }>,
        templeApi.list() as Promise<{ data: Temple[] }>,
      ]);
      setDonations(dRes.data || []);
      setTemples(tRes.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await donationApi.create(token, { ...form, amount: parseFloat(form.amount) });
      setShowForm(false);
      fetchData();
    } catch { /* ignore */ }
  };

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  if (loading) return <div>Loading donations...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Donations</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Make Donation</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>New Donation</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Temple</label>
                <select className="form-control" value={form.templeId} onChange={e => update('templeId', e.target.value)} required>
                  <option value="">Select Temple</option>
                  {temples.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (INR)</label>
                <input type="number" className="form-control" value={form.amount} onChange={e => update('amount', e.target.value)} required min="1" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={form.category} onChange={e => update('category', e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Payment Method</label>
                <select className="form-control" value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="NET_BANKING">Net Banking</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Purpose (Optional)</label>
                <input className="form-control" value={form.purpose} onChange={e => update('purpose', e.target.value)} />
              </div>
              <div className="form-group">
                <label>PAN Card (for 80G)</label>
                <input className="form-control" value={form.donorPan} onChange={e => update('donorPan', e.target.value)} placeholder="ABCDE1234F" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">Submit Donation</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Donation #</th><th>Date</th><th>Amount</th><th>Category</th><th>Payment</th><th>Status</th><th>80G</th></tr>
          </thead>
          <tbody>
            {donations.map(d => (
              <tr key={d.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.donationNumber}</td>
                <td>{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                <td style={{ fontWeight: 600 }}>₹{d.amount.toLocaleString('en-IN')}</td>
                <td>{d.category.replace(/_/g, ' ')}</td>
                <td>{d.paymentMethod.replace(/_/g, ' ')}</td>
                <td><span className={`badge ${d.paymentStatus === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{d.paymentStatus}</span></td>
                <td>{d.is80GEligible ? <span className="badge badge-info">Eligible</span> : '-'}</td>
              </tr>
            ))}
            {donations.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No donations yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
