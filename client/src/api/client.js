const TOKEN_KEY = 'aca_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (raw) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  signup: (email, password, inviteCode) => request('/auth/signup', { method: 'POST', body: { email, password, inviteCode } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),

  listCompanies: () => request('/companies'),
  createCompany: (payload) => request('/companies', { method: 'POST', body: payload }),
  getCompany: (id) => request(`/companies/${id}`),

  getCatalog: () => request('/documents/catalog'),
  getProviders: () => request('/documents/providers'),
  listDocuments: (companyId) => request(`/documents?companyId=${companyId}`),
  getDocument: (id) => request(`/documents/${id}`),
  generateDocument: (companyId, framework, docType, provider) =>
    request('/documents/generate', { method: 'POST', body: { companyId, framework, docType, provider } }),
  exportDocumentUrl: (id) => `/api/documents/${id}/export`,
};
