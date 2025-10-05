/**
 * API Client for Data Labeler Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.detail || errorData.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Files API
export const filesApi = {
  async upload(file: File, sessionId?: string): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    return apiRequest('/files/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    });
  },

  async list(sessionId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);

    return apiRequest(`/files?${params.toString()}`);
  },

  async get(fileId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/files/${fileId}`);
  },

  async delete(fileId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  async getValidation(fileId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/files/${fileId}/validation`);
  },
};

// Rules API
export const rulesApi = {
  async list(activeOnly?: boolean): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (activeOnly) params.append('active_only', 'true');

    return apiRequest(`/rules?${params.toString()}`);
  },

  async get(ruleId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/rules/${ruleId}`);
  },

  async create(rule: any): Promise<ApiResponse<any>> {
    return apiRequest('/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  },

  async update(ruleId: string, updates: any): Promise<ApiResponse<any>> {
    return apiRequest(`/rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(ruleId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/rules/${ruleId}`, {
      method: 'DELETE',
    });
  },

  async preview(ruleId: string, fileId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/rules/${ruleId}/preview?file_id=${fileId}`);
  },

  async apply(ruleId: string, fileId: string, transactionIds?: string[]): Promise<ApiResponse<any>> {
    return apiRequest(`/rules/${ruleId}/apply?file_id=${fileId}`, {
      method: 'POST',
      body: transactionIds ? JSON.stringify({ transaction_ids: transactionIds }) : undefined,
    });
  },

  async validate(ruleId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/rules/${ruleId}/validate`, {
      method: 'POST',
    });
  },

  async createFromTransaction(fileId: string, transactionId: string, labelId: string, ruleName?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({
      file_id: fileId,
      transaction_id: transactionId,
      label_id: labelId,
    });
    if (ruleName) params.append('rule_name', ruleName);

    return apiRequest(`/rules/create-from-transaction?${params.toString()}`, {
      method: 'POST',
    });
  },

  async matchRules(fileId: string, ruleIds?: string[]): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ file_id: fileId });
    if (ruleIds) {
      ruleIds.forEach(id => params.append('rule_ids', id));
    }

    return apiRequest(`/rules/match?${params.toString()}`, {
      method: 'POST',
    });
  },
};

// Recommendations API
export const recommendationsApi = {
  async getSmartSuggestions(fileId: string, limit?: number, minConfidence?: number): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ file_id: fileId });
    if (limit) params.append('limit', limit.toString());
    if (minConfidence) params.append('min_confidence', minConfidence.toString());

    return apiRequest(`/recommendations/smart-suggestions?${params.toString()}`);
  },

  async analyzePatterns(fileId: string, includeStatistics?: boolean): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ file_id: fileId });
    if (includeStatistics !== undefined) params.append('include_statistics', includeStatistics.toString());

    return apiRequest(`/recommendations/pattern-analysis?${params.toString()}`);
  },
};

// Health check
export const healthApi = {
  async check(): Promise<ApiResponse<any>> {
    return apiRequest('/health');
  },
};
