const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  auth: {
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request('/auth/me'),
  },
  requirements: {
    list: (params = {}) => request('/requirements?' + new URLSearchParams(params)),
    stats: () => request('/requirements/stats'),
    get: (id) => request(`/requirements/${id}`),
    create: (body) => request('/requirements', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/requirements/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/requirements/${id}`, { method: 'DELETE' }),
    addTag: (id, tag_id) => request(`/requirements/${id}/tags`, { method: 'POST', body: JSON.stringify({ tag_id }) }),
    removeTag: (id, tagId) => request(`/requirements/${id}/tags/${tagId}`, { method: 'DELETE' }),
    addLink: (id, body) => request(`/requirements/${id}/links`, { method: 'POST', body: JSON.stringify(body) }),
    removeLink: (id, linkId) => request(`/requirements/${id}/links/${linkId}`, { method: 'DELETE' }),
  },
  tags: {
    list: () => request('/requirements/meta/tags'),
    create: (body) => request('/requirements/meta/tags', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id) => request(`/requirements/meta/tags/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request('/users'),
    create: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
    setRole: (id, role) => request(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },
  projects: {
    list: () => request('/projects'),
    get: (id) => request(`/projects/${id}`),
    create: (body) => request('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
    createModule: (id, body) => request(`/projects/${id}/modules`, { method: 'POST', body: JSON.stringify(body) }),
  },
  modules: {
    list: () => request('/modules'),
    get: (id) => request(`/modules/${id}`),
    update: (id, body) => request(`/modules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/modules/${id}`, { method: 'DELETE' }),
  },
};
