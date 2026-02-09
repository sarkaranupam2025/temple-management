import { useState, useEffect } from 'react';

interface PrasadItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  isVegetarian: boolean;
  isSugarFree: boolean;
  maxPerDevotee: number;
  allergens?: string;
}

interface PrasadOrder {
  id: string;
  tokenCode: string;
  quantity: number;
  totalPrice: number;
  status: string;
  validUntil: string;
  prasad: { name: string };
}

interface Props { token: string; }

const statusColors: Record<string, string> = {
  ordered: 'badge-warning', preparing: 'badge-info', ready: 'badge-success',
  picked_up: 'badge-secondary', expired: 'badge-danger',
};

export default function PrasadPage({ token }: Props) {
  const [items, setItems] = useState<PrasadItem[]>([]);
  const [orders, setOrders] = useState<PrasadOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const [itemRes, orderRes] = await Promise.all([
          fetch('/api/prasad/items', { headers }).then(r => r.json()),
          fetch('/api/prasad/orders', { headers }).then(r => r.json()),
        ]);
        setItems(itemRes.data || []);
        setOrders(orderRes.data || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  if (loading) return <div>Loading prasad...</div>;

  return (
    <div>
      <div className="page-header"><h1>Prasad</h1></div>

      <h3 style={{ marginBottom: 12 }}>Available Prasad Items</h3>
      <div className="data-grid" style={{ marginBottom: 24 }}>
        {items.map(item => (
          <div key={item.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <h3>{item.name}</h3>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{item.price}</span>
            </div>
            {item.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0' }}>{item.description}</p>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {item.isVegetarian && <span className="badge badge-success">Veg</span>}
              {item.isSugarFree && <span className="badge badge-info">Sugar Free</span>}
              {item.isAvailable ? <span className="badge badge-success">Available</span> : <span className="badge badge-danger">Unavailable</span>}
            </div>
            {item.allergens && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Allergens: {item.allergens}</div>}
          </div>
        ))}
        {items.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No prasad items available.</p>}
      </div>

      <h3 style={{ marginBottom: 12 }}>My Prasad Orders</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Token</th><th>Prasad</th><th>Qty</th><th>Amount</th><th>Status</th><th>Valid Until</th></tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{o.tokenCode}</td>
                <td>{o.prasad?.name}</td>
                <td>{o.quantity}</td>
                <td>₹{o.totalPrice}</td>
                <td><span className={`badge ${statusColors[o.status] || 'badge-secondary'}`}>{o.status}</span></td>
                <td>{new Date(o.validUntil).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
