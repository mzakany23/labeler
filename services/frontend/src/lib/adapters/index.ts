/**
 * State Persistence Adapters
 * 
 * Export all adapters and utilities
 */

export * from './types';
export * from './LocalStorageAdapter';
export * from './BackendAdapter';
export * from './StateSync';

import { LocalStorageAdapter } from './LocalStorageAdapter';
import { BackendAdapter } from './BackendAdapter';
import { StateSync } from './StateSync';
import { SyncStrategy, ConflictResolution } from './types';

/**
 * Create a configured StateSync instance
 */
export function createStateSync(options?: {
  strategy?: SyncStrategy;
  conflictResolution?: ConflictResolution;
  autoSync?: boolean;
  syncInterval?: number;
  backendUrl?: string;
}) {
  const localAdapter = new LocalStorageAdapter();
  const backendAdapter = new BackendAdapter({
    baseUrl: options?.backendUrl,
  });

  return new StateSync({
    adapters: [localAdapter, backendAdapter],
    strategy: options?.strategy || 'local-first',
    conflictResolution: options?.conflictResolution || 'latest-wins',
    autoSync: options?.autoSync ?? true,
    syncInterval: options?.syncInterval || 30000,
    retryAttempts: 3,
    retryDelay: 5000,
  });
}

/**
 * Global StateSync instance
 */
let globalStateSync: StateSync | null = null;

/**
 * Get or create the global StateSync instance
 */
export function getStateSync(options?: {
  strategy?: SyncStrategy;
  conflictResolution?: ConflictResolution;
  autoSync?: boolean;
  syncInterval?: number;
  backendUrl?: string;
}): StateSync {
  if (!globalStateSync) {
    globalStateSync = createStateSync(options);
  }
  return globalStateSync;
}

/**
 * Reset the global StateSync instance
 */
export function resetStateSync(): void {
  if (globalStateSync) {
    globalStateSync.stopAutoSync();
    globalStateSync = null;
  }
}
