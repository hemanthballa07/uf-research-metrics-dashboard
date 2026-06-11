// Typed API client for the UF Research Metrics Platform
import type { ExpiryResponse } from '@uf-research-metrics-platform/shared';
import type {
  Grant,
  Faculty,
  Department,
  Sponsor,
} from '@uf-research-metrics-platform/sdk';

// `??` (not `||`) so an explicitly-empty VITE_API_URL is honored → same-origin relative `/api`
// (prod behind one ALB). Unset (dev/tests) → undefined → the localhost default.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Grant as returned by list/detail endpoints — the OpenAPI-generated base entity
// plus the relations the API includes. Sourcing the base shape from the SDK means
// these fields cannot drift from the server's Zod schema.
type GrantWithRelations = Grant & {
  sponsor?: Sponsor;
  pi?: Faculty;
  department?: Department;
};

interface ApiError {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    fields?: Record<string, string[]>;
  };
}

class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

import { getToken, clearToken } from './auth.js';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const token = getToken();

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch (err) {
    // Handle network errors (connection failures, timeouts, etc.)
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new NetworkError(
        'Unable to connect to the server. Please check your internet connection and try again.'
      );
    }
    throw new NetworkError('Network error occurred. Please try again.');
  }

  // Check if response is JSON before parsing
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    let errorCode: string | undefined;
    let errorFields: Record<string, string[]> | undefined;

    if (isJson) {
      try {
        const error = (await response.json()) as ApiError;
        errorMessage = error.error?.message || errorMessage;
        errorCode = error.error?.code;
        errorFields = error.error?.fields;
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || errorMessage;
      }
    } else {
      // For non-JSON error responses, use status text
      errorMessage = response.statusText || `Server returned ${response.status}`;
    }

    if (response.status === 401) {
      clearToken();
      window.location.replace('/login');
    }

    throw new ApiClientError(errorMessage, response.status, errorCode, errorFields);
  }

  // Parse JSON response
  if (isJson) {
    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new ApiClientError(
        'Invalid response format from server',
        500,
        'INVALID_RESPONSE'
      );
    }
  }

  // For non-JSON responses, return response as-is (handled by specific methods like exportGrants)
  return response as unknown as T;
}

// API methods
export const api = {
  // Auth
  async login(email: string, password: string) {
    return fetchApi<{ accessToken: string; user: { id: number; email: string; role: string } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
  },

  // Health check
  async getHealth() {
    return fetchApi<{ status: string; timestamp: string; service: string }>('/api/health');
  },

  // Metrics
  async getMetricsSummary() {
    return fetchApi<{
      totalSubmissions: number;
      totalAwardedAmount: number;
      awardRate: number;
      medianTimeToAward: number | null;
    }>('/api/metrics/summary');
  },

  // Status Breakdown
  async getStatusBreakdown() {
    return fetchApi<Array<{ status: string; count: number }>>('/api/metrics/status-breakdown');
  },

  // Time Series
  async getTimeSeries(params?: { months?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.months) {
      searchParams.append('months', String(params.months));
    }
    const queryString = searchParams.toString();
    return fetchApi<Array<{
      month: string;
      submissions: number;
      awards: number;
      awardedAmount: number;
    }>>(`/api/metrics/timeseries${queryString ? `?${queryString}` : ''}`);
  },

  // Awards by Sponsor Type
  async getAwardsBySponsorType(params?: { months?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.months) {
      searchParams.append('months', String(params.months));
    }
    const queryString = searchParams.toString();
    return fetchApi<Array<{
      sponsorType: string;
      awardedAmount: number;
      count: number;
    }>>(`/api/metrics/awards-by-sponsor-type${queryString ? `?${queryString}` : ''}`);
  },

  // Insights (consolidated endpoint)
  async getInsights(params?: {
    months?: number;
    departmentId?: number;
    sponsorType?: string;
    status?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.months) {
      searchParams.append('months', String(params.months));
    }
    if (params?.departmentId) {
      searchParams.append('departmentId', String(params.departmentId));
    }
    if (params?.sponsorType) {
      searchParams.append('sponsorType', params.sponsorType);
    }
    if (params?.status) {
      searchParams.append('status', params.status);
    }
    const queryString = searchParams.toString();
    return fetchApi<{
      summary: {
        submissions: number;
        awards: number;
        awardRate: number;
        totalAwardedAmount: number;
        medianTimeToAward: number | null;
        avgAwardSize: number;
      };
      timeseries: Array<{
        month: string;
        submissions: number;
        awards: number;
        awardedAmount: number;
        statusCounts: {
          draft: number;
          submitted: number;
          under_review: number;
          awarded: number;
          declined: number;
        };
      }>;
      dailyActivity: Array<{
        date: string;
        submissions: number;
        awards: number;
        awardedAmount: number;
      }>;
      sponsorBreakdown: Array<{
        name: string;
        sponsorType: string | null;
        awardedAmount: number;
        count: number;
      }>;
      departmentBreakdown: Array<{
        departmentId: number;
        name: string;
        awardedAmount: number;
        awards: number;
        submissions: number;
      }>;
      funnel: {
        submitted: number;
        underReview: number;
        awarded: number;
        declined: number;
      };
    }>(`/api/insights${queryString ? `?${queryString}` : ''}`);
  },

  // Grants
  async getGrants(params?: {
    department?: number;
    sponsor?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    return fetchApi<{
      items: GrantWithRelations[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/api/grants${queryString ? `?${queryString}` : ''}`);
  },

  // Faculty Leaderboard
  async getFacultyLeaderboard(params?: { department?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.department) {
      searchParams.append('department', String(params.department));
    }
    const queryString = searchParams.toString();
    return fetchApi<Array<{
      facultyId: number;
      facultyName: string;
      departmentName: string;
      totalAwarded: number;
      rank: number;
    }>>(`/api/faculty/leaderboard${queryString ? `?${queryString}` : ''}`);
  },

  // Departments
  async getDepartments() {
    return fetchApi<Department[]>('/api/departments');
  },

  // Sponsors
  async getSponsors() {
    return fetchApi<Sponsor[]>('/api/sponsors');
  },

  // Get single grant
  async getGrantById(id: number) {
    return fetchApi<GrantWithRelations>(`/api/grants/${id}`);
  },

  // Ingest grants via CSV — async: returns a jobId to poll.
  async ingestGrants(csvText: string) {
    return fetchApi<{
      jobId: string;
      status: string;
      totalRows: number;
      batches: number;
      errors: Array<{ row: number; error: string }>;
    }>('/api/ingest/grants', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: csvText,
    });
  },

  // Poll an ingest job's status/progress.
  async getIngestJob(jobId: string) {
    return fetchApi<{
      jobId: string;
      status: 'queued' | 'processing' | 'completed';
      totalRows: number;
      totalBatches: number;
      batchesDone: number;
      inserted: number;
      updated: number;
      errors: Array<{ row: number; error: string }>;
    }>(`/api/ingest/jobs/${jobId}`);
  },

  // Users
  async listUsers(params?: { page?: number; pageSize?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    const queryString = searchParams.toString();
    return fetchApi<{
      items: Array<{ id: number; email: string; name: string; role: string; createdAt: string; updatedAt: string }>;
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/users${queryString ? `?${queryString}` : ''}`);
  },

  async createUser(data: { email: string; name: string; password: string; role: string }) {
    return fetchApi<{ id: number; email: string; name: string; role: string; createdAt: string }>(
      '/api/users',
      { method: 'POST', body: JSON.stringify(data) }
    );
  },

  async updateUserRole(id: number, role: string) {
    return fetchApi<{ id: number; email: string; name: string; role: string; createdAt: string }>(
      `/api/users/${id}/role`,
      { method: 'PATCH', body: JSON.stringify({ role }) }
    );
  },

  async deleteUser(id: number) {
    return fetchApi<void>(
      `/api/users/${id}`,
      { method: 'DELETE' }
    );
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return fetchApi<{ message: string }>(
      '/api/auth/change-password',
      { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }
    );
  },

  // Export grants
  async exportGrants(params?: {
    department?: number;
    sponsor?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    format?: 'csv' | 'json';
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    const url = `${API_URL}/api/grants/export${queryString ? `?${queryString}` : ''}`;
    const token = getToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      if (response.status === 401) {
        clearToken();
        window.location.replace('/login');
      }
      const error = await response.json();
      throw new ApiClientError(
        error.error?.message || 'Export failed',
        response.status,
        error.error?.code
      );
    }
    const blob = await response.blob();
    return blob;
  },

  async getExpiringGrants() {
    return fetchApi<ExpiryResponse>('/api/grants/expiring');
  },

  // Semantic neighbours of a grant (pgvector cosine). Empty if the grant has no embedding.
  async getSimilarGrants(id: number, k = 5) {
    return fetchApi<{ items: Array<GrantWithRelations & { score: number }> }>(
      `/api/grants/${id}/similar?k=${k}`
    );
  },

  // RAG: stream a Claude answer over SSE. Dispatches text deltas, retrieved sources, and errors.
  async ask(
    question: string,
    handlers: {
      onText: (delta: string) => void;
      onSources: (grants: GrantWithRelations[]) => void;
      onError: (message: string) => void;
    }
  ): Promise<void> {
    const token = getToken();
    const response = await fetch(`${API_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok || !response.body) {
      if (response.status === 401) {
        clearToken();
        window.location.replace('/login');
        return;
      }
      let msg = 'Ask failed';
      try {
        const e = (await response.json()) as ApiError;
        msg = e.error?.message || msg;
      } catch {
        /* keep default */
      }
      handlers.onError(msg);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
        const data = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
        if (!data) continue;
        const parsed = JSON.parse(data) as {
          delta?: string;
          grants?: GrantWithRelations[];
          message?: string;
        };
        if (event === 'text' && parsed.delta) handlers.onText(parsed.delta);
        else if (event === 'sources' && parsed.grants) handlers.onSources(parsed.grants);
        else if (event === 'error') handlers.onError(parsed.message ?? 'Unknown error');
      }
    }
  },
};

export { ApiClientError, NetworkError };

