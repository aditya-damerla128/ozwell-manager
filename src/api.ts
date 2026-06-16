export type Identity = {
  id: string;
  external_user_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export type MeResponse = {
  identity: Identity;
  status: string;
  is_admin: boolean;
  has_parent_key: boolean;
  parent_key_id?: string;
  parent_key_hint?: string;
  provisioned: boolean;
};

export type AgentListItem = {
  id: string;
  key_hint?: string;
  name?: string;
  model?: string;
  tools?: unknown;
  behavior?: unknown;
  created_at?: number;
};

export type AgentDetail = {
  agent_id: string;
  key_hint?: string;
  created_at?: number;
  yaml: string;
  name?: string;
  instructions?: string;
  model?: string;
  temperature?: number;
  tools?: unknown;
  behavior?: unknown;
};

export type KeyResponse = {
  agent_id: string;
  agent_key: string;
  key_hint?: string;
  rotated_at?: number;
};

export type ParentKeyResponse = {
  parent_key?: string;
  key?: string;
  parent_key_id?: string;
  parent_key_hint?: string;
  key_hint?: string;
};

export type ModelListItem = {
  id: string;
};

export type UsageMetrics = {
  request_count?: number;
  error_count?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  last_used_at?: number | string | null;
};

export type AdminSummary = {
  users_total?: number;
  users_active?: number;
  admins_total?: number;
  parent_keys_total?: number;
  parent_keys_active?: number;
  parent_keys_revoked?: number;
  agents_total?: number;
  usage?: UsageMetrics;
};

export type AdminParentKey = {
  id: string;
  name?: string;
  key_hint?: string;
  status?: string;
  source?: string;
  revoked_at?: number | string | null;
  revoked_reason?: string | null;
  agent_count?: number;
  metrics?: UsageMetrics;
};

export type AdminAgent = {
  id: string;
  name?: string;
  key_hint?: string;
  parent_key_id?: string;
  parent_key_hint?: string;
  model?: string;
  metrics?: UsageMetrics;
};

export type AdminUser = {
  id: string;
  external_user_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  is_admin?: boolean;
  created_at?: number | string | null;
  last_seen_at?: number | string | null;
  parent_key_count?: number;
  active_parent_key_count?: number;
  agent_count?: number;
  request_count?: number;
  total_tokens?: number;
  last_used_at?: number | string | null;
  current_parent_key?: AdminParentKey | null;
  metrics?: UsageMetrics;
};

export type AdminUserDetail = {
  user: AdminUser;
  parent_keys?: AdminParentKey[];
  agents?: AdminAgent[];
  unattributed_usage?: UsageMetrics;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const configuredBaseUrl = import.meta.env.VITE_OZWELL_API_BASE_URL || '';
export const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '');

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    const code =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { code?: string } }).error?.code
        : undefined;
    throw new ApiError(errorMessage(payload, `Request failed with ${response.status}`), response.status, code);
  }

  return payload as T;
}

export function getMe() {
  return request<MeResponse>('/v1/manager/me', { cache: 'no-store' });
}

export async function listAgents() {
  const payload = await request<{ data?: AgentListItem[] }>('/v1/manager/agents', { cache: 'no-store' });
  return payload.data || [];
}

export function getAgent(agentId: string) {
  return request<AgentDetail>(`/v1/manager/agents/${encodeURIComponent(agentId)}`, { cache: 'no-store' });
}

export function createAgent(yaml: string) {
  return request<KeyResponse>('/v1/manager/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/yaml' },
    body: yaml,
  });
}

export function updateAgent(agentId: string, yaml: string) {
  return request<AgentDetail & { updated: true }>(`/v1/manager/agents/${encodeURIComponent(agentId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/yaml' },
    body: yaml,
  });
}

export function revealAgentKey(agentId: string) {
  return request<KeyResponse>(`/v1/manager/agents/${encodeURIComponent(agentId)}/reveal-key`, {
    method: 'POST',
  });
}

export function rotateAgentKey(agentId: string) {
  return request<KeyResponse>(`/v1/manager/agents/${encodeURIComponent(agentId)}/rotate-key`, {
    method: 'POST',
  });
}

export function deleteAgent(agentId: string) {
  return request<{ id: string; deleted: true }>(`/v1/manager/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
  });
}

export async function listModels() {
  const payload = await request<{ data?: ModelListItem[] }>('/v1/manager/models', { cache: 'no-store' });
  return payload.data || [];
}

export function revealParentKey() {
  return request<ParentKeyResponse>('/v1/manager/parent-key/reveal', {
    method: 'POST',
  });
}

export function claimParentKey(parentKey: string) {
  return request<MeResponse>('/v1/manager/claim-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_key: parentKey }),
  });
}

export function getAdminSummary() {
  return request<AdminSummary>('/v1/manager/admin/summary', { cache: 'no-store' });
}

export async function listAdminUsers() {
  const payload = await request<{ data?: AdminUser[] }>('/v1/manager/admin/users', { cache: 'no-store' });
  return payload.data || [];
}

export function getAdminUser(userId: string) {
  return request<AdminUserDetail>(`/v1/manager/admin/users/${encodeURIComponent(userId)}`, { cache: 'no-store' });
}

export function promoteAdminUser(userId: string) {
  return request<AdminUser>(`/v1/manager/admin/users/${encodeURIComponent(userId)}/promote`, {
    method: 'POST',
  });
}

export function demoteAdminUser(userId: string) {
  return request<AdminUser>(`/v1/manager/admin/users/${encodeURIComponent(userId)}/demote`, {
    method: 'POST',
  });
}

export function revokeAdminParentKey(keyId: string, reason = 'admin_revoked') {
  return request<{ id: string; status: string; revoked_at?: number | string | null; revoked_reason?: string | null }>(
    `/v1/manager/admin/parent-keys/${encodeURIComponent(keyId)}/revoke`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
}
