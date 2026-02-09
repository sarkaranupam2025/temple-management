import { useState, useEffect } from 'react';
import { commApi } from '../services/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category?: string;
  priority: string;
  publishAt: string;
  temple?: { name: string };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface SpiritualContent {
  id: string;
  title: string;
  type: string;
  author?: string;
  language: string;
  viewCount: number;
}

interface Props { token: string; }

const priorityColors: Record<string, string> = {
  low: 'badge-secondary', normal: 'badge-info', high: 'badge-warning', urgent: 'badge-danger',
};

export default function CommunicationPage({ token }: Props) {
  const [tab, setTab] = useState<'announcements' | 'notifications' | 'content'>('announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [content, setContent] = useState<SpiritualContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, nRes, cRes] = await Promise.all([
          commApi.getAnnouncements() as Promise<{ data: Announcement[] }>,
          commApi.getNotifications(token) as Promise<{ data: Notification[] }>,
          commApi.getContent() as Promise<{ data: SpiritualContent[] }>,
        ]);
        setAnnouncements(aRes.data || []);
        setNotifications(nRes.data || []);
        setContent(cRes.data || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  const markRead = async (id: string) => {
    try {
      await commApi.markRead(token, id);
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* ignore */ }
  };

  if (loading) return <div>Loading...</div>;

  const tabs = [
    { key: 'announcements' as const, label: 'Announcements', count: announcements.length },
    { key: 'notifications' as const, label: 'Notifications', count: notifications.filter(n => !n.isRead).length },
    { key: 'content' as const, label: 'Spiritual Content', count: content.length },
  ];

  return (
    <div>
      <div className="page-header"><h1>Communication Hub</h1></div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.key)}>
            {t.label} {t.count > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'announcements' && (
        <div>
          {announcements.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3>{a.title}</h3>
                <span className={`badge ${priorityColors[a.priority] || 'badge-secondary'}`}>{a.priority}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{a.content}</p>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                {a.temple?.name && `${a.temple.name} | `}
                {new Date(a.publishAt).toLocaleDateString('en-IN')}
                {a.category && ` | ${a.category}`}
              </div>
            </div>
          ))}
          {announcements.length === 0 && <div className="card"><p style={{ color: 'var(--text-muted)' }}>No announcements.</p></div>}
        </div>
      )}

      {tab === 'notifications' && (
        <div>
          {notifications.map(n => (
            <div key={n.id} className="card" style={{ opacity: n.isRead ? 0.7 : 1, borderLeft: n.isRead ? 'none' : '3px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15 }}>{n.title}</h3>
                {!n.isRead && <button className="btn btn-sm btn-secondary" onClick={() => markRead(n.id)}>Mark Read</button>}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{n.message}</p>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {n.type} | {new Date(n.createdAt).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
          {notifications.length === 0 && <div className="card"><p style={{ color: 'var(--text-muted)' }}>No notifications.</p></div>}
        </div>
      )}

      {tab === 'content' && (
        <div className="data-grid">
          {content.map(c => (
            <div key={c.id} className="card">
              <h3 style={{ marginBottom: 4 }}>{c.title}</h3>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span className="badge badge-info">{c.type}</span>
                <span className="badge badge-secondary">{c.language}</span>
              </div>
              {c.author && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>By {c.author}</div>}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{c.viewCount} views</div>
            </div>
          ))}
          {content.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No content available.</p>}
        </div>
      )}
    </div>
  );
}
