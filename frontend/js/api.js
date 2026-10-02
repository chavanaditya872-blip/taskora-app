/* Global API helper + auth token storage + toast notifications */
const API_BASE = (() => {
  // If page is served from file:// or from a static server, point to backend.
  // Adjust this constant if your backend runs elsewhere.
  return window.TASKORA_API_BASE || 'http://127.0.0.1:8000';
})();

const Auth = {
  TOKEN_KEY: 'taskora_token',
  USER_KEY: 'taskora_user',

  getToken() { return localStorage.getItem(this.TOKEN_KEY); },
  setToken(t) { localStorage.setItem(this.TOKEN_KEY, t); },
  getUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser(u) { localStorage.setItem(this.USER_KEY, JSON.stringify(u)); },
  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },
  isAuthenticated() { return !!this.getToken(); },
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },
};

async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (err) {
    throw new Error('Network error: cannot reach the server');
  }

  if (response.status === 401 && auth) {
    Auth.clear();
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 204) return null;

  let data = null;
  const text = await response.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { detail: text }; }
  }

  if (!response.ok) {
    let message = 'Request failed';
    if (data) {
      if (typeof data.detail === 'string') message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map(e => e.msg).join(', ');
      else if (data.message) message = data.message;
    }
    throw new Error(message);
  }
  return data;
}

const API = {
  // Auth
  register: (payload) => apiRequest('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => apiRequest('/api/auth/login', { method: 'POST', body: payload, auth: false }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => null),
  me: () => apiRequest('/api/auth/me'),
  updateMe: (payload) => apiRequest('/api/auth/me', { method: 'PUT', body: payload }),

  // Tasks
  listTasks: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) qs.append(k, v); });
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/api/tasks${suffix}`);
  },
  getTask: (id) => apiRequest(`/api/tasks/${id}`),
  createTask: (payload) => apiRequest('/api/tasks', { method: 'POST', body: payload }),
  updateTask: (id, payload) => apiRequest(`/api/tasks/${id}`, { method: 'PUT', body: payload }),
  updateTaskStatus: (id, status) => apiRequest(`/api/tasks/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteTask: (id) => apiRequest(`/api/tasks/${id}`, { method: 'DELETE' }),
  taskStats: () => apiRequest('/api/tasks/stats'),

  // Categories
  listCategories: () => apiRequest('/api/categories'),
  createCategory: (name) => apiRequest('/api/categories', { method: 'POST', body: { name } }),
  updateCategory: (id, name) => apiRequest(`/api/categories/${id}`, { method: 'PUT', body: { name } }),
  deleteCategory: (id) => apiRequest(`/api/categories/${id}`, { method: 'DELETE' }),
};

/* Toast notifications */
function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) { console.log(`[toast:${type}]`, message); return; }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, duration);
}

/* Confirm dialog */
function confirmDialog(message) {
  return window.confirm(message);
}

/* Format helpers */
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}
function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date();
}
function statusLabel(s) {
  return ({ todo: 'To Do', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' })[s] || s;
}
function priorityLabel(p) {
  return ({ low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' })[p] || p;
}

// Add this to the bottom of js/api.js
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}