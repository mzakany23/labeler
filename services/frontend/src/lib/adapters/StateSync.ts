/**
 * State Sync Manager
 * 
 * Coordinates state persistence across multiple adapters with
 * automatic fallback, conflict resolution, and sync strategies
 */

import { DataState } from '@/types';
import {
  StateAdapter,
  PersistedState,
  SessionMetadata,
  SyncResult,
  SyncConfig,
  SyncStrategy,
  ConflictResolution,
} from './types';

export interface StateSyncConfig extends Partial<SyncConfig> {
  adapters: StateAdapter[];
  primaryAdapter?: string; // Name of primary adapter
}

export class StateSync {
  private adapters: Map<string, StateAdapter> = new Map();
  private config: SyncConfig;
  private syncTimer?: NodeJS.Timeout;
  private pendingSyncs: Map<string, PersistedState> = new Map();

  constructor(config: StateSyncConfig) {
    // Register adapters
    for (const adapter of config.adapters) {
      this.adapters.set(adapter.name, adapter);
    }

    // Set default config
    this.config = {
      strategy: config.strategy || 'local-first',
      conflictResolution: config.conflictResolution || 'latest-wins',
      autoSync: config.autoSync ?? true,
      syncInterval: config.syncInterval || 30000, // 30 seconds
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000, // 5 seconds
    };

    // Start auto-sync if enabled
    if (this.config.autoSync && this.config.syncInterval) {
      this.startAutoSync();
    }
  }

  /**
   * Save state using the configured strategy
   */
  async saveState(
    sessionId: string,
    dataState: DataState,
    activeTab: string,
    type: 'data' | 'labels' | 'rules'
  ): Promise<SyncResult> {
    const adapters = this.getAdaptersByStrategy();
    const results: SyncResult[] = [];

    for (const adapter of adapters) {
      const result = await this.saveToAdapter(
        adapter,
        sessionId,
        dataState,
        activeTab,
        type
      );
      results.push(result);

      // For backend-first, stop if backend succeeds
      if (
        this.config.strategy === 'backend-first' &&
        adapter.name === 'backend' &&
        result.success
      ) {
        break;
      }

      // For local-first, continue to backend for sync
      if (
        this.config.strategy === 'local-first' &&
        adapter.name === 'localStorage' &&
        result.success
      ) {
        // Queue backend sync but don't wait
        this.queueBackendSync(sessionId, dataState, activeTab, type);
      }
    }

    // Return the primary result
    const primaryResult = results.find(r => r.success) || results[0];
    return primaryResult;
  }

  /**
   * Load state using the configured strategy
   */
  async loadState(sessionId: string): Promise<PersistedState | null> {
    const adapters = this.getAdaptersByStrategy();
    const states: Array<{ adapter: string; state: PersistedState }> = [];

    for (const adapter of adapters) {
      const state = await adapter.loadState(sessionId);
      if (state) {
        states.push({ adapter: adapter.name, state });
      }
    }

    if (states.length === 0) {
      return null;
    }

    // If only one state found, return it
    if (states.length === 1) {
      return states[0].state;
    }

    // Handle conflicts
    return this.resolveConflict(states);
  }

  /**
   * Delete session from all adapters
   */
  async deleteSession(sessionId: string): Promise<SyncResult> {
    const results: SyncResult[] = [];

    for (const adapter of Array.from(this.adapters.values())) {
      const result = await adapter.deleteSession(sessionId);
      results.push(result);
    }

    // Return success if at least one adapter succeeded
    const success = results.some(r => r.success);
    return {
      success,
      sessionId,
      timestamp: new Date(),
      error: success ? undefined : 'Failed to delete from all adapters',
    };
  }

  /**
   * List sessions from all adapters and merge
   */
  async listSessions(): Promise<SessionMetadata[]> {
    const allSessions = new Map<string, SessionMetadata>();

    for (const adapter of Array.from(this.adapters.values())) {
      const sessions = await adapter.listSessions();
      for (const session of sessions) {
        const existing = allSessions.get(session.sessionId);
        if (!existing || session.lastModified > existing.lastModified) {
          allSessions.set(session.sessionId, session);
        }
      }
    }

    return Array.from(allSessions.values()).sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    );
  }

  /**
   * Check if session exists in any adapter
   */
  async hasSession(sessionId: string): Promise<boolean> {
    for (const adapter of Array.from(this.adapters.values())) {
      if (await adapter.hasSession(sessionId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get active session from primary adapter
   */
  async getActiveSessionId(): Promise<string | null> {
    const primary = this.getPrimaryAdapter();
    return primary.getActiveSessionId();
  }

  /**
   * Set active session in all adapters
   */
  async setActiveSessionId(sessionId: string): Promise<void> {
    for (const adapter of Array.from(this.adapters.values())) {
      await adapter.setActiveSessionId(sessionId);
    }
  }

  /**
   * Clear active session from all adapters
   */
  async clearActiveSessionId(): Promise<void> {
    for (const adapter of Array.from(this.adapters.values())) {
      await adapter.clearActiveSessionId();
    }
  }

  /**
   * Clear all sessions from all adapters
   */
  async clearAll(): Promise<SyncResult> {
    const results: SyncResult[] = [];

    for (const adapter of Array.from(this.adapters.values())) {
      const result = await adapter.clearAll();
      results.push(result);
    }

    const success = results.every(r => r.success);
    return {
      success,
      sessionId: 'all',
      timestamp: new Date(),
    };
  }

  /**
   * Manually trigger sync between adapters
   */
  async syncNow(): Promise<void> {
    const sessions = await this.listSessions();

    for (const session of sessions) {
      await this.syncSession(session.sessionId);
    }
  }

  /**
   * Get sync status for a session
   */
  async getSyncStatus(sessionId: string): Promise<{
    adapters: Array<{ name: string; synced: boolean; lastSync?: Date }>;
    needsSync: boolean;
  }> {
    const adapters = [];
    let latestTimestamp: Date | null = null;

    for (const adapter of Array.from(this.adapters.values())) {
      const state = await adapter.loadState(sessionId);
      if (state) {
        adapters.push({
          name: adapter.name,
          synced: true,
          lastSync: state.metadata.lastSyncedAt,
        });

        if (!latestTimestamp || state.updatedAt > latestTimestamp) {
          latestTimestamp = state.updatedAt;
        }
      } else {
        adapters.push({
          name: adapter.name,
          synced: false,
        });
      }
    }

    // Check if any adapter is out of sync
    const needsSync = adapters.some(a => {
      if (!a.synced) return true;
      if (!a.lastSync || !latestTimestamp) return true;
      return a.lastSync < latestTimestamp;
    });

    return { adapters, needsSync };
  }

  /**
   * Health check for all adapters
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const health = new Map<string, boolean>();

    for (const [name, adapter] of Array.from(this.adapters.entries())) {
      const isHealthy = await adapter.healthCheck();
      health.set(name, isHealthy);
    }

    return health;
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Start auto-sync
   */
  startAutoSync(): void {
    this.stopAutoSync();

    if (this.config.syncInterval) {
      this.syncTimer = setInterval(() => {
        this.syncPendingChanges();
      }, this.config.syncInterval);
    }
  }

  // Private methods

  private getAdaptersByStrategy(): StateAdapter[] {
    const adapters = Array.from(this.adapters.values());

    switch (this.config.strategy) {
      case 'backend-first':
        return adapters.sort((a, b) => b.priority - a.priority);
      case 'local-first':
        return adapters.sort((a, b) => a.priority - b.priority);
      case 'backend-only':
        return adapters.filter(a => a.name === 'backend');
      case 'local-only':
        return adapters.filter(a => a.name === 'localStorage');
      case 'hybrid':
      default:
        return adapters.sort((a, b) => b.priority - a.priority);
    }
  }

  private getPrimaryAdapter(): StateAdapter {
    const adapters = this.getAdaptersByStrategy();
    return adapters[0];
  }

  private async saveToAdapter(
    adapter: StateAdapter,
    sessionId: string,
    dataState: DataState,
    activeTab: string,
    type: 'data' | 'labels' | 'rules'
  ): Promise<SyncResult> {
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.config.retryAttempts) {
      const result = await adapter.saveState(sessionId, dataState, activeTab, type);

      if (result.success) {
        return result;
      }

      lastError = result.error;
      attempts++;

      if (attempts < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay);
      }
    }

    return {
      success: false,
      sessionId,
      timestamp: new Date(),
      error: lastError || 'Max retry attempts reached',
    };
  }

  private async queueBackendSync(
    sessionId: string,
    dataState: DataState,
    activeTab: string,
    type: 'data' | 'labels' | 'rules'
  ): Promise<void> {
    const backend = this.adapters.get('backend');
    if (!backend) return;

    // Save to pending syncs
    const now = new Date();
    const metadata: SessionMetadata = {
      sessionId,
      fileName: dataState.fileName,
      lastModified: now,
      rowCount: dataState.data?.length || 0,
      labelCount: dataState.labels.length,
      ruleCount: dataState.rules.length,
      storageType: 'hybrid',
      syncStatus: 'pending',
      version: '1.0.0',
    };

    this.pendingSyncs.set(sessionId, {
      sessionId,
      dataState,
      activeTab,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    // Try to sync immediately in background
    backend.saveState(sessionId, dataState, activeTab, type).then(result => {
      if (result.success) {
        this.pendingSyncs.delete(sessionId);
      }
    });
  }

  private async syncPendingChanges(): Promise<void> {
    const backend = this.adapters.get('backend');
    if (!backend) return;

    for (const [sessionId, state] of Array.from(this.pendingSyncs.entries())) {
      const result = await backend.saveState(
        sessionId,
        state.dataState,
        state.activeTab,
        'data'
      );

      if (result.success) {
        this.pendingSyncs.delete(sessionId);
      }
    }
  }

  private async syncSession(sessionId: string): Promise<void> {
    const states: Array<{ adapter: StateAdapter; state: PersistedState }> = [];

    for (const adapter of Array.from(this.adapters.values())) {
      const state = await adapter.loadState(sessionId);
      if (state) {
        states.push({ adapter, state });
      }
    }

    if (states.length === 0) return;

    // Find the most recent state
    const latest = states.reduce((prev, curr) =>
      curr.state.updatedAt > prev.state.updatedAt ? curr : prev
    );

    // Sync to all other adapters
    for (const adapter of Array.from(this.adapters.values())) {
      if (adapter.name !== latest.adapter.name) {
        await adapter.saveState(
          sessionId,
          latest.state.dataState,
          latest.state.activeTab,
          'data'
        );
      }
    }
  }

  private resolveConflict(
    states: Array<{ adapter: string; state: PersistedState }>
  ): PersistedState {
    switch (this.config.conflictResolution) {
      case 'backend-wins':
        return (
          states.find(s => s.adapter === 'backend')?.state || states[0].state
        );

      case 'local-wins':
        return (
          states.find(s => s.adapter === 'localStorage')?.state ||
          states[0].state
        );

      case 'latest-wins':
      default:
        return states.reduce((prev, curr) =>
          curr.state.updatedAt > prev.state.updatedAt ? curr : prev
        ).state;

      // TODO: Implement merge strategy
      case 'merge':
        return states[0].state;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
