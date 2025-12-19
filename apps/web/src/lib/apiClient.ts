// Typed API client for the UF Research Metrics Platform

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiError {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
  };
}

class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new ApiClientError(
      error.error?.message || 'An error occurred',
      response.status,
      error.error?.code
    );
  }

  return data as T;
}

// API methods
export const api = {
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
      items: Array<{
        id: number;
        title: string;
        sponsorId: number;
        piId: number;
        departmentId: number;
        amount: number;
        status: string;
        submittedAt: string | null;
        awardedAt: string | null;
        createdAt: string;
        updatedAt: string;
        sponsor?: { id: number; name: string; sponsorType: string };
        pi?: { id: number; name: string; email: string; departmentId: number };
        department?: { id: number; name: string };
      }>;
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
};

export { ApiClientError };

