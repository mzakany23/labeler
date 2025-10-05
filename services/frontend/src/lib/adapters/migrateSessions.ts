/**
 * Session Migration Utility
 * 
 * Migrates old localStorage-only sessions to the new StateSync system
 * and syncs them to the backend
 */

import { getStateSync } from './index';

export interface MigrationResult {
  totalSessions: number;
  migratedToBackend: number;
  alreadySynced: number;
  failed: string[];
}

/**
 * Migrate all localStorage sessions to backend
 */
export async function migrateLocalSessionsToBackend(): Promise<MigrationResult> {
  const stateSync = getStateSync();
  const result: MigrationResult = {
    totalSessions: 0,
    migratedToBackend: 0,
    alreadySynced: 0,
    failed: [],
  };

  try {
    // Get all sessions from localStorage
    const localSessions = await stateSync.listSessions();
    result.totalSessions = localSessions.length;

    console.log(`[Migration] Found ${localSessions.length} sessions in localStorage`);

    for (const sessionMeta of localSessions) {
      try {
        // Check sync status
        const syncStatus = await stateSync.getSyncStatus(sessionMeta.sessionId);
        
        const backendAdapter = syncStatus.adapters.find(a => a.name === 'backend');
        const localAdapter = syncStatus.adapters.find(a => a.name === 'localStorage');

        // If exists in localStorage but not in backend, migrate it
        if (localAdapter?.synced && !backendAdapter?.synced) {
          console.log(`[Migration] Syncing session ${sessionMeta.sessionId} to backend...`);
          
          // Load from localStorage
          const sessionData = await stateSync.loadState(sessionMeta.sessionId);
          
          if (sessionData) {
            // Force save to backend by triggering a sync
            await stateSync.saveState(
              sessionMeta.sessionId,
              sessionData.dataState,
              sessionData.activeTab,
              'data'
            );
            
            result.migratedToBackend++;
            console.log(`[Migration] ✓ Synced ${sessionMeta.sessionId}`);
          }
        } else if (backendAdapter?.synced) {
          result.alreadySynced++;
          console.log(`[Migration] ✓ Already synced: ${sessionMeta.sessionId}`);
        }
      } catch (error) {
        console.error(`[Migration] Failed to migrate ${sessionMeta.sessionId}:`, error);
        result.failed.push(sessionMeta.sessionId);
      }
    }

    console.log('[Migration] Complete:', result);
    return result;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return result;
  }
}

/**
 * Sync a specific session to backend
 */
export async function syncSessionToBackend(sessionId: string): Promise<boolean> {
  try {
    const stateSync = getStateSync();
    const sessionData = await stateSync.loadState(sessionId);
    
    if (!sessionData) {
      console.warn(`[Sync] Session ${sessionId} not found`);
      return false;
    }

    const result = await stateSync.saveState(
      sessionId,
      sessionData.dataState,
      sessionData.activeTab,
      'data'
    );

    if (result.success) {
      console.log(`[Sync] ✓ Synced ${sessionId} to backend`);
      return true;
    } else {
      console.error(`[Sync] Failed to sync ${sessionId}:`, result.error);
      return false;
    }
  } catch (error) {
    console.error(`[Sync] Error syncing ${sessionId}:`, error);
    return false;
  }
}

/**
 * Check if backend is available and trigger migration if needed
 * Returns a promise that resolves with the migration result
 */
export async function autoMigrateIfNeeded(): Promise<MigrationResult | null> {
  try {
    const stateSync = getStateSync();
    const health = await stateSync.healthCheck();
    
    const backendHealthy = health.get('backend');
    
    if (backendHealthy) {
      console.log('[Migration] Backend is available, checking for sessions to migrate...');
      
      // Emit event for UI to show notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-start'));
      }
      
      // Run migration
      const result = await migrateLocalSessionsToBackend();
      
      if (result.migratedToBackend > 0) {
        console.log(`[Migration] Successfully migrated ${result.migratedToBackend} sessions to backend`);
        
        // Emit success event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-complete', { 
            detail: { count: result.migratedToBackend } 
          }));
        }
      } else if (result.failed.length > 0) {
        // Emit error event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-error', { 
            detail: { failed: result.failed } 
          }));
        }
      }
      
      return result;
    } else {
      console.log('[Migration] Backend not available, skipping migration');
      return null;
    }
  } catch (error) {
    console.error('[Migration] Auto-migration check failed:', error);
    
    // Emit error event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-error', { 
        detail: { error: error instanceof Error ? error.message : 'Unknown error' } 
      }));
    }
    
    return null;
  }
}
