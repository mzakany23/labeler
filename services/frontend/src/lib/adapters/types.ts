/**
 * State Persistence Adapter System
 * 
 * Provides a flexible contract for persisting application state
 * across different storage backends (localStorage, remote API, etc.)
 */

import { DataState } from '@/types';

/**
 * Metadata about a persisted session
 */
export interface SessionMetadata {
  sessionId: string;
  fileName: string | null;
  lastModified: Date;
  rowCount: number;
  labelCount: number;
  ruleCount: number;
  storageType: 'local' | 'backend' | 'hybrid';
  syncStatus?: 'synced' | 'pending' | 'conflict' | 'error';
  lastSyncedAt?: Date;
  version?: string;
}

/**
 * Persisted state structure
 */
export interface PersistedState {
  sessionId: string;
  dataState: DataState;
  activeTab: string;
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sync result from adapter operations
 */
export interface SyncResult {
  success: boolean;
  sessionId: string;
  timestamp: Date;
  error?: string;
  metadata?: SessionMetadata;
}

/**
 * Adapter capabilities
 */
export interface AdapterCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canList: boolean;
  supportsRealtime: boolean;
  requiresAuth: boolean;
  isOnline: boolean;
}

/**
 * Core adapter interface that all storage adapters must implement
 */
export interface StateAdapter {
  /**
   * Unique identifier for this adapter
   */
  readonly name: string;

  /**
   * Priority for conflict resolution (higher = preferred)
   */
  readonly priority: number;

  /**
   * Get adapter capabilities
   */
  getCapabilities(): Promise<AdapterCapabilities>;

  /**
   * Save state to storage
   */
  saveState(
    sessionId: string,
    dataState: DataState,
    activeTab: string,
    type: 'data' | 'labels' | 'rules'
  ): Promise<SyncResult>;

  /**
   * Load state from storage
   */
  loadState(sessionId: string): Promise<PersistedState | null>;

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): Promise<SyncResult>;

  /**
   * List all available sessions
   */
  listSessions(): Promise<SessionMetadata[]>;

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): Promise<boolean>;

  /**
   * Get the active session ID
   */
  getActiveSessionId(): Promise<string | null>;

  /**
   * Set the active session ID
   */
  setActiveSessionId(sessionId: string): Promise<void>;

  /**
   * Clear the active session ID
   */
  clearActiveSessionId(): Promise<void>;

  /**
   * Clear all sessions (use with caution)
   */
  clearAll(): Promise<SyncResult>;

  /**
   * Health check for the adapter
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Sync strategy for multi-adapter coordination
 */
export type SyncStrategy = 
  | 'local-first'      // Prefer local, sync to backend when available
  | 'backend-first'    // Prefer backend, fallback to local
  | 'hybrid'           // Use both, merge conflicts
  | 'local-only'       // Only use local storage
  | 'backend-only';    // Only use backend

/**
 * Conflict resolution strategy
 */
export type ConflictResolution =
  | 'local-wins'       // Local changes take precedence
  | 'backend-wins'     // Backend changes take precedence
  | 'latest-wins'      // Most recent timestamp wins
  | 'merge';           // Attempt to merge changes

/**
 * Sync configuration
 */
export interface SyncConfig {
  strategy: SyncStrategy;
  conflictResolution: ConflictResolution;
  autoSync: boolean;
  syncInterval?: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}
