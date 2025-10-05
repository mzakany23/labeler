/**
 * State Persistence V2
 * 
 * Backward-compatible wrapper around the new adapter system
 * This allows gradual migration from the old statePersistence.ts
 */

import { DataState } from '@/types';
import { getStateSync, SessionMetadata as AdapterSessionMetadata } from './adapters';

// Re-export types for backward compatibility
export interface SessionMetadata extends AdapterSessionMetadata {}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save state to storage using the adapter system
 */
export function saveStateToStorage(
  sessionId: string,
  dataState: DataState,
  activeTab: string,
  type: 'data' | 'labels' | 'rules' = 'data'
): void {
  const stateSync = getStateSync();
  
  // Fire and forget - don't block UI
  stateSync.saveState(sessionId, dataState, activeTab, type).catch(error => {
    console.error('Failed to save state:', error);
  });
}

/**
 * Load state from storage using the adapter system
 */
export function loadStateFromStorage(sessionId: string): {
  dataState: DataState;
  activeTab: string;
} | null {
  // This needs to be synchronous for backward compatibility
  // We'll use localStorage adapter directly for immediate access
  const localAdapter = getStateSync()['adapters'].get('localStorage');
  
  if (!localAdapter) {
    console.warn('LocalStorage adapter not available');
    return null;
  }

  // Use a synchronous approach by reading from localStorage directly
  try {
    const key = `data-labeler:session:${sessionId}`;
    const data = localStorage.getItem(key);
    
    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    
    return {
      dataState: {
        ...parsed.dataState,
        labels: parsed.dataState.labels.map((label: any) => ({
          ...label,
          createdAt: new Date(label.createdAt),
        })),
        rules: parsed.dataState.rules.map((rule: any) => ({
          ...rule,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt),
        })),
        actionHistory: parsed.dataState.actionHistory.map((action: any) => ({
          ...action,
          timestamp: new Date(action.timestamp),
        })),
      },
      activeTab: parsed.activeTab,
    };
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

/**
 * Clear stored state for a session
 */
export async function clearStoredState(sessionId: string): Promise<void> {
  const stateSync = getStateSync();
  await stateSync.deleteSession(sessionId);
}

/**
 * Check if there is stored data for a session
 */
export function hasStoredData(sessionId: string): boolean {
  try {
    const key = `data-labeler:session:${sessionId}`;
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Get the active session ID
 */
export function getActiveSessionId(): string | null {
  try {
    return localStorage.getItem('data-labeler:active-session');
  } catch {
    return null;
  }
}

/**
 * Clear the active session ID
 */
export async function clearActiveSessionId(): Promise<void> {
  const stateSync = getStateSync();
  await stateSync.clearActiveSessionId();
}

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<SessionMetadata[]> {
  const stateSync = getStateSync();
  return stateSync.listSessions();
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const stateSync = getStateSync();
  await stateSync.deleteSession(sessionId);
}

/**
 * Manually trigger sync between adapters
 */
export async function syncNow(): Promise<void> {
  const stateSync = getStateSync();
  await stateSync.syncNow();
}

/**
 * Get sync status for a session
 */
export async function getSyncStatus(sessionId: string) {
  const stateSync = getStateSync();
  return stateSync.getSyncStatus(sessionId);
}

/**
 * Check health of all adapters
 */
export async function checkAdapterHealth() {
  const stateSync = getStateSync();
  return stateSync.healthCheck();
}
