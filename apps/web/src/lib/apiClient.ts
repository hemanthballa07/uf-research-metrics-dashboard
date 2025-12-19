// Typed API client for the UF Research Metrics Platform

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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

  // Departments
  async getDepartments() {
    return fetchApi<Array<{ id: number; name: string }>>('/api/departments');
  },

  // Sponsors
  async getSponsors() {
    return fetchApi<Array<{ id: number; name: string; sponsorType: string }>>('/api/sponsors');
  },

  // Get single grant
  async getGrantById(id: number) {
    return fetchApi<{
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
    }>(`/api/grants/${id}`);
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
    const response = await fetch(url);
    if (!response.ok) {
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
};

export { ApiClientError, NetworkError };

