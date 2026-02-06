const API_BASE = '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const authApi = {
  register: (body: Record<string, string>) => request('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) => request('/auth/login', { method: 'POST', body }),
  getProfile: (token: string) => request('/auth/profile', { token }),
  updateProfile: (token: string, body: Record<string, string>) => request('/auth/profile', { method: 'PUT', body, token }),
};

// Temples
export const templeApi = {
  list: (params?: string) => request(`/temples${params ? `?${params}` : ''}`),
  getById: (id: string) => request(`/temples/${id}`),
  create: (token: string, body: Record<string, unknown>) => request('/temples', { method: 'POST', body, token }),
  update: (token: string, id: string, body: Record<string, unknown>) => request(`/temples/${id}`, { method: 'PUT', body, token }),
};

// Bookings
export const bookingApi = {
  getSlots: (templeId: string, date: string) => request(`/bookings/slots?templeId=${templeId}&date=${date}`),
  create: (token: string, body: Record<string, unknown>) => request('/bookings', { method: 'POST', body, token }),
  list: (token: string, params?: string) => request(`/bookings${params ? `?${params}` : ''}`, { token }),
  getById: (token: string, id: string) => request(`/bookings/${id}`, { token }),
  cancel: (token: string, id: string, reason?: string) => request(`/bookings/${id}/cancel`, { method: 'PUT', body: { reason }, token }),
};

// Donations
export const donationApi = {
  create: (token: string, body: Record<string, unknown>) => request('/donations', { method: 'POST', body, token }),
  list: (token: string, params?: string) => request(`/donations${params ? `?${params}` : ''}`, { token }),
  getById: (token: string, id: string) => request(`/donations/${id}`, { token }),
  getStats: (token: string, templeId: string) => request(`/donations/stats?templeId=${templeId}`, { token }),
};

// Prasad
export const prasadApi = {
  getItems: (templeId: string) => request(`/prasad/items?templeId=${templeId}`),
  createOrder: (token: string, body: Record<string, unknown>) => request('/prasad/orders', { method: 'POST', body, token }),
  getOrders: (token: string, params?: string) => request(`/prasad/orders${params ? `?${params}` : ''}`, { token }),
};

// Communication
export const commApi = {
  getNotifications: (token: string) => request('/communication/notifications', { token }),
  markRead: (token: string, id: string) => request(`/communication/notifications/${id}/read`, { method: 'PUT', token }),
  getAnnouncements: (templeId?: string) => request(`/communication/announcements${templeId ? `?templeId=${templeId}` : ''}`),
  getContent: (params?: string) => request(`/communication/content${params ? `?${params}` : ''}`),
  getLostFound: (params?: string) => request(`/communication/lost-found${params ? `?${params}` : ''}`),
};

// Analytics
export const analyticsApi = {
  getDashboard: (token: string, templeId: string) => request(`/analytics/dashboard?templeId=${templeId}`, { token }),
  getVisitors: (token: string, params: string) => request(`/analytics/visitors?${params}`, { token }),
  getFinancial: (token: string, params: string) => request(`/analytics/financial?${params}`, { token }),
  getFeedback: (token: string, params: string) => request(`/analytics/feedback?${params}`, { token }),
};

// Volunteers
export const volunteerApi = {
  createProfile: (token: string, body: Record<string, unknown>) => request('/volunteers/profile', { method: 'POST', body, token }),
  list: (token: string, params?: string) => request(`/volunteers${params ? `?${params}` : ''}`, { token }),
  getLeaderboard: () => request('/volunteers/leaderboard'),
  getShifts: (token: string, params?: string) => request(`/volunteers/shifts${params ? `?${params}` : ''}`, { token }),
};
