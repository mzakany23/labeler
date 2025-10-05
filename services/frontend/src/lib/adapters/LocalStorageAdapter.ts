/**
 * LocalStorage Adapter
 * 
 * Implements state persistence using browser localStorage
 */

import { DataState } from '@/types';
import {
  StateAdapter,
  PersistedState,
  SessionMetadata,
  SyncResult,
  AdapterCapabilities
} from './types';

const STORAGE_PREFIX = 'data-labeler';
const ACTIVE_SESSION_KEY = `${STORAGE_PREFIX}:active-session`;
const SESSION_LIST_KEY = `${STORAGE_PREFIX}:sessions`;

export class LocalStorageAdapter implements StateAdapter {
  readonly name = 'localStorage';
  readonly priority = 1; // Lower priority than backend

  async getCapabilities(): Promise<AdapterCapabilities> {
    return {
      canRead: true,
      canWrite: true,
      canDelete: true,
      canList: true,
      supportsRealtime: false,
      requiresAuth: false,
      isOnline: true, // localStorage is always "online"
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
      const existingState = await this.loadState(sessionId);

      const metadata: SessionMetadata = {
        sessionId,
        fileName: dataState.fileName,
        lastModified: now,
        rowCount: dataState.data?.length || 0,
        labelCount: dataState.labels.length,
        ruleCount: dataState.rules.length,
        storageType: 'local',
        syncStatus: 'synced',
        lastSyncedAt: now,
        version: '1.0.0',
      };

      const persistedState: PersistedState = {
        sessionId,
        dataState,
        activeTab,
        metadata,
        createdAt: existingState?.createdAt || now,
        updatedAt: now,
      };

      // Save to localStorage
      const key = this.getSessionKey(sessionId);
      localStorage.setItem(key, JSON.stringify(persistedState));

      // Update session list
      await this.updateSessionList(sessionId, metadata);

      // Set as active session
      await this.setActiveSessionId(sessionId);

      return {
        success: true,
        sessionId,
        timestamp: now,
        metadata,
      };
    } catch (error) {
      console.error('LocalStorageAdapter: Failed to save state', error);
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
      const key = this.getSessionKey(sessionId);
      const data = localStorage.getItem(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data) as PersistedState;

      // Deserialize dates
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
        metadata: {
          ...parsed.metadata,
          lastModified: new Date(parsed.metadata.lastModified),
          lastSyncedAt: parsed.metadata.lastSyncedAt
            ? new Date(parsed.metadata.lastSyncedAt)
            : undefined,
        },
        dataState: {
          ...parsed.dataState,
          labels: parsed.dataState.labels.map(label => ({
            ...label,
            createdAt: new Date(label.createdAt),
          })),
          rules: parsed.dataState.rules.map(rule => ({
            ...rule,
            createdAt: new Date(rule.createdAt),
            updatedAt: new Date(rule.updatedAt),
          })),
          actionHistory: parsed.dataState.actionHistory.map(action => ({
            ...action,
            timestamp: new Date(action.timestamp),
          })),
        },
      };
    } catch (error) {
      console.error('LocalStorageAdapter: Failed to load state', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<SyncResult> {
    try {
      const key = this.getSessionKey(sessionId);
      localStorage.removeItem(key);

      // Remove from session list
      const sessionList = await this.getSessionList();
      const updatedList = sessionList.filter(id => id !== sessionId);
      localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(updatedList));

      // Clear active session if it was this one
      const activeSession = await this.getActiveSessionId();
      if (activeSession === sessionId) {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }

      return {
        success: true,
        sessionId,
        timestamp: new Date(),
      };
    } catch (error) {
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
      const sessionIds = await this.getSessionList();
      const sessions: SessionMetadata[] = [];

      for (const sessionId of sessionIds) {
        const state = await this.loadState(sessionId);
        if (state) {
          sessions.push(state.metadata);
        }
      }

      // Sort by last modified (newest first)
      return sessions.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
      );
    } catch (error) {
      console.error('LocalStorageAdapter: Failed to list sessions', error);
      return [];
    }
  }

  async hasSession(sessionId: string): Promise<boolean> {
    const key = this.getSessionKey(sessionId);
    return localStorage.getItem(key) !== null;
  }

  async getActiveSessionId(): Promise<string | null> {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  }

  async setActiveSessionId(sessionId: string): Promise<void> {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  }

  async clearActiveSessionId(): Promise<void> {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }

  async clearAll(): Promise<SyncResult> {
    try {
      const sessionIds = await this.getSessionList();

      for (const sessionId of sessionIds) {
        const key = this.getSessionKey(sessionId);
        localStorage.removeItem(key);
      }

      localStorage.removeItem(SESSION_LIST_KEY);
      localStorage.removeItem(ACTIVE_SESSION_KEY);

      return {
        success: true,
        sessionId: 'all',
        timestamp: new Date(),
      };
    } catch (error) {
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
      const testKey = `${STORAGE_PREFIX}:health-check`;
      const testValue = Date.now().toString();
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return retrieved === testValue;
    } catch {
      return false;
    }
  }

  // Helper methods

  private getSessionKey(sessionId: string): string {
    return `${STORAGE_PREFIX}:session:${sessionId}`;
  }

  private async getSessionList(): Promise<string[]> {
    const data = localStorage.getItem(SESSION_LIST_KEY);
    return data ? JSON.parse(data) : [];
  }

  private async updateSessionList(
    sessionId: string,
    metadata: SessionMetadata
  ): Promise<void> {
    const sessionList = await this.getSessionList();
    if (!sessionList.includes(sessionId)) {
      sessionList.push(sessionId);
      localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
    }
  }
}
