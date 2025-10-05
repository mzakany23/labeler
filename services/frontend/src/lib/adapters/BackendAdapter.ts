/**
 * Backend Adapter
 * 
 * Implements state persistence using backend API
 */

import { DataState } from '@/types';
import {
  StateAdapter,
  PersistedState,
  SessionMetadata,
  SyncResult,
  AdapterCapabilities
} from './types';
import { ApiClient, createApiClient } from '../api/client';

export interface BackendAdapterConfig {
  apiClient?: ApiClient;
  baseUrl?: string;
}

export class BackendAdapter implements StateAdapter {
  readonly name = 'backend';
  readonly priority = 10; // Higher priority than localStorage

  private client: ApiClient;
  private isOnline: boolean = true;

  constructor(config?: BackendAdapterConfig) {
    this.client = config?.apiClient || createApiClient(config?.baseUrl);
    this.checkOnlineStatus();
  }

  async getCapabilities(): Promise<AdapterCapabilities> {
    return {
      canRead: true,
      canWrite: true,
      canDelete: true,
      canList: true,
      supportsRealtime: false,
      requiresAuth: false,
      isOnline: this.isOnline,
    };
  }

  async saveState(
    sessionId: string,
    dataState: DataState,
    activeTab: string,
    type: 'data' | 'labels' | 'rules'
  ): Promise<SyncResult> {
    try {
      const now = new Date();

      const metadata: SessionMetadata = {
        sessionId,
        fileName: dataState.fileName,
        lastModified: now,
        rowCount: dataState.data?.length || 0,
        labelCount: dataState.labels.length,
        ruleCount: dataState.rules.length,
        storageType: 'backend',
        syncStatus: 'synced',
        lastSyncedAt: now,
        version: '1.0.0',
      };

      const payload = {
        sessionId,
        dataState,
        activeTab,
        metadata,
        type,
      };

      const response = await this.client.post(`/sessions/${sessionId}`, payload);

      if (response.error) {
        this.isOnline = false;
        return {
          success: false,
          sessionId,
          timestamp: now,
          error: response.error,
        };
      }

      this.isOnline = true;
      return {
        success: true,
        sessionId,
        timestamp: now,
        metadata,
      };
    } catch (error) {
      this.isOnline = false;
      console.error('BackendAdapter: Failed to save state', error);
      return {
        success: false,
        sessionId,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async loadState(sessionId: string): Promise<PersistedState | null> {
    try {
      const response = await this.client.get<PersistedState>(`/sessions/${sessionId}`);

      if (response.error || !response.data) {
        this.isOnline = response.status !== 0;
        return null;
      }

      this.isOnline = true;
      const data = response.data;

      // Deserialize dates
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        metadata: {
          ...data.metadata,
          lastModified: new Date(data.metadata.lastModified),
          lastSyncedAt: data.metadata.lastSyncedAt
            ? new Date(data.metadata.lastSyncedAt)
            : undefined,
        },
        dataState: {
          ...data.dataState,
          labels: data.dataState.labels.map(label => ({
            ...label,
            createdAt: new Date(label.createdAt),
          })),
          rules: data.dataState.rules.map(rule => ({
            ...rule,
            createdAt: new Date(rule.createdAt),
            updatedAt: new Date(rule.updatedAt),
          })),
          actionHistory: data.dataState.actionHistory.map(action => ({
            ...action,
            timestamp: new Date(action.timestamp),
          })),
        },
      };
    } catch (error) {
      this.isOnline = false;
      console.error('BackendAdapter: Failed to load state', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<SyncResult> {
    try {
      const response = await this.client.delete(`/sessions/${sessionId}`);

      if (response.error) {
        this.isOnline = false;
        return {
          success: false,
          sessionId,
          timestamp: new Date(),
          error: response.error,
        };
      }

      this.isOnline = true;
      return {
        success: true,
        sessionId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.isOnline = false;
      return {
        success: false,
        sessionId,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listSessions(): Promise<SessionMetadata[]> {
    try {
      const response = await this.client.get<SessionMetadata[]>('/sessions');

      if (response.error || !response.data) {
        this.isOnline = response.status !== 0;
        return [];
      }

      this.isOnline = true;
      return response.data.map(metadata => ({
        ...metadata,
        lastModified: new Date(metadata.lastModified),
        lastSyncedAt: metadata.lastSyncedAt
          ? new Date(metadata.lastSyncedAt)
          : undefined,
      }));
    } catch (error) {
      this.isOnline = false;
      console.error('BackendAdapter: Failed to list sessions', error);
      return [];
    }
  }

  async hasSession(sessionId: string): Promise<boolean> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/exists`);
      this.isOnline = response.status !== 0;
      return response.status === 200;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  async getActiveSessionId(): Promise<string | null> {
    try {
      const response = await this.client.get<{ sessionId: string }>('/sessions/active');

      if (response.error || !response.data) {
        this.isOnline = response.status !== 0;
        return null;
      }

      this.isOnline = true;
      return response.data.sessionId;
    } catch {
      this.isOnline = false;
      return null;
    }
  }

  async setActiveSessionId(sessionId: string): Promise<void> {
    try {
      await this.client.post('/sessions/active', { sessionId });
      this.isOnline = true;
    } catch {
      this.isOnline = false;
    }
  }

  async clearActiveSessionId(): Promise<void> {
    try {
      await this.client.delete('/sessions/active');
      this.isOnline = true;
    } catch {
      this.isOnline = false;
    }
  }

  async clearAll(): Promise<SyncResult> {
    try {
      const response = await this.client.delete('/sessions');

      if (response.error) {
        this.isOnline = false;
        return {
          success: false,
          sessionId: 'all',
          timestamp: new Date(),
          error: response.error,
        };
      }

      this.isOnline = true;
      return {
        success: true,
        sessionId: 'all',
        timestamp: new Date(),
      };
    } catch (error) {
      this.isOnline = false;
      return {
        success: false,
        sessionId: 'all',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const isHealthy = await this.client.healthCheck();
      this.isOnline = isHealthy;
      return isHealthy;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  private async checkOnlineStatus(): Promise<void> {
    this.isOnline = await this.healthCheck();
  }
}
