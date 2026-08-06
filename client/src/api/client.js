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
  signup: (email, password, inviteCode, name) => request('/auth/signup', { method: 'POST', body: { email, password, inviteCode, name } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  getMe: () => request('/auth/me'),
  updateMe: (name) => request('/auth/me', { method: 'PATCH', body: { name } }),

  listCompanies: () => request('/companies'),
  createCompany: (payload) => request('/companies', { method: 'POST', body: payload }),
  getCompany: (id) => request(`/companies/${id}`),
  updateCompany: (id, patch) => request(`/companies/${id}`, { method: 'PATCH', body: patch }),
  listCompanyAlerts: (id) => request(`/companies/${id}/alerts`),
  dismissAlert: (companyId, alertId) => request(`/companies/${companyId}/alerts/${alertId}/dismiss`, { method: 'POST' }),
  async uploadCompanyLogo(companyId, file) {
    const formData = new FormData();
    formData.append('logo', file);
    const token = getToken();
    const res = await fetch(`/api/companies/${companyId}/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  removeCompanyLogo: (companyId) => request(`/companies/${companyId}/logo`, { method: 'DELETE' }),

  getGapAnalysis: (companyId) => request(`/compliance/gap-analysis?companyId=${companyId}`),
  getEvidenceTargets: () => request('/compliance/evidence-targets'),
  getTimeline: (companyId) => request(`/compliance/timeline?companyId=${companyId}`),
  getRiskPrediction: (companyId) => request(`/compliance/risk-prediction?companyId=${companyId}`),
  getStrategy: (companyId) => request(`/compliance/strategy?companyId=${companyId}`),
  simulateGapAnalysis: (companyId, itemKeys) => request('/compliance/simulate', { method: 'POST', body: { companyId, itemKeys } }),

  listConnectors: (companyId) => request(`/connectors?companyId=${companyId}`),
  startGithubConnect: (companyId) => request(`/connectors/github/start?companyId=${companyId}`),
  syncGithubConnector: (companyId) => request('/connectors/github/sync', { method: 'POST', body: { companyId } }),
  disconnectGithubConnector: (companyId) => request(`/connectors/github?companyId=${companyId}`, { method: 'DELETE' }),
  generateExecutiveReport: (companyId, provider) => request('/reports/executive', { method: 'POST', body: { companyId, provider } }),

  listChatMessages: (companyId) => request(`/chat?companyId=${companyId}`),
  sendChatMessage: (companyId, message, provider) => request('/chat', { method: 'POST', body: { companyId, message, provider } }),
  clearChat: (companyId) => request(`/chat?companyId=${companyId}`, { method: 'DELETE' }),

  listVendors: (companyId) => request(`/vendors?companyId=${companyId}`),
  detectVendors: (companyId, provider) => request('/vendors/detect', { method: 'POST', body: { companyId, provider } }),
  deleteVendor: (id) => request(`/vendors/${id}`, { method: 'DELETE' }),

  listEvidence: (companyId) => request(`/evidence?companyId=${companyId}`),
  deleteEvidence: (id) => request(`/evidence/${id}`, { method: 'DELETE' }),
  async uploadEvidence(companyId, file, provider) {
    const formData = new FormData();
    formData.append('companyId', companyId);
    if (provider) formData.append('provider', provider);
    formData.append('file', file);
    const token = getToken();
    const res = await fetch('/api/evidence/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },

  getCatalog: () => request('/documents/catalog'),
  getProviders: () => request('/documents/providers'),
  listDocuments: (companyId) => request(`/documents?companyId=${companyId}`),
  getDocument: (id) => request(`/documents/${id}`),
  generateDocument: (companyId, framework, docType, provider) =>
    request('/documents/generate', { method: 'POST', body: { companyId, framework, docType, provider } }),
  checkDocumentConsistency: (companyId, provider) =>
    request('/documents/consistency-check', { method: 'POST', body: { companyId, provider } }),
  exportDocumentUrl: (id) => `/api/documents/${id}/export`,
};
