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
    resetPassword: (id, new_password) => request(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ new_password }) }),
    changePassword: (current_password, new_password) => request('/users/me/password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) }),
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
  links: {
    list: (params = {}) => request('/requirements/meta/links?' + new URLSearchParams(params)),
  },
  baselines: {
    list: (project_id) => request(`/baselines?project_id=${project_id}`),
    get: (id) => request(`/baselines/${id}`),
    create: (body) => request('/baselines', { method: 'POST', body: JSON.stringify(body) }),
    restore: (id) => request(`/baselines/${id}/restore`, { method: 'POST' }),
    delete: (id) => request(`/baselines/${id}`, { method: 'DELETE' }),
  },
  export: {
    project: async (id) => {
      const res = await fetch(`${BASE}/projects/${id}/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    },
  },
  wiki: {
    list: (params = {}) => request('/wiki-pages?' + new URLSearchParams(params)),
    get: (id) => request(`/wiki-pages/${id}`),
    getByModule: (moduleId) => request(`/wiki-pages/by-module/${moduleId}`),
    getTree: (projectId) => request(`/wiki-pages/tree/${projectId}`),
    create: (body) => request('/wiki-pages', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/wiki-pages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/wiki-pages/${id}`, { method: 'DELETE' }),
  },
  llm: {
    upload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${BASE}/llm/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    },
    chat: (messages) => request('/llm/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
    import: (module_id, requirements) => request('/llm/import', { method: 'POST', body: JSON.stringify({ module_id, requirements }) }),
  },
};
