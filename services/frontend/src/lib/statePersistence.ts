import { DataState } from '@/types';

const STORAGE_KEY_PREFIX = 'data-labeler-session-';
const STORAGE_VERSION = '1.0';
const ACTIVE_SESSION_KEY = 'data-labeler-active-session';

interface PersistedState {
  version: string;
  dataState: DataState;
  activeTab: 'labeling' | 'report' | 'labels';
  currentView: 'upload' | 'data';
  timestamp: number;
}

// Helper function to serialize state with proper Set/Map/Date handling
const serializeState = (state: any): any => {
  if (state instanceof Set) {
    return { __type: 'Set', values: Array.from(state) };
  }
  if (state instanceof Map) {
    return { __type: 'Map', values: Array.from(state.entries()) };
  }
  if (state instanceof Date) {
    return { __type: 'Date', value: state.toISOString() };
  }
  if (Array.isArray(state)) {
    return state.map(item => serializeState(item));
  }
  if (state && typeof state === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(state)) {
      serialized[key] = serializeState(value);
    }
    return serialized;
  }
  return state;
};

// Helper function to deserialize state with proper Set/Map/Date restoration
const deserializeState = (state: any): any => {
  if (state && typeof state === 'object' && state.__type) {
    switch (state.__type) {
      case 'Set':
        return new Set(state.values);
      case 'Map':
        return new Map(state.values);
      case 'Date':
        return new Date(state.value);
      default:
        return state;
    }
  }
  if (Array.isArray(state)) {
    return state.map(item => deserializeState(item));
  }
  if (state && typeof state === 'object') {
    const deserialized: any = {};
    for (const [key, value] of Object.entries(state)) {
      deserialized[key] = deserializeState(value);
    }
    return deserialized;
  }
  return state;
};

// Generate a unique session ID
export const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// Get the storage key for a specific session
const getSessionStorageKey = (sessionId: string): string => {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
};

// Save state to a specific session
export const saveStateToStorage = (
  sessionId: string,
  dataState: DataState,
  activeTab: 'labeling' | 'report' | 'labels',
  currentView: 'upload' | 'data'
) => {
  try {
    const serializedDataState = serializeState(dataState);

    const stateToSave: PersistedState = {
      version: STORAGE_VERSION,
      dataState: serializedDataState,
      activeTab,
      currentView,
      timestamp: Date.now()
    };

    const storageKey = getSessionStorageKey(sessionId);
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));

    // Track this as the active session
    if (dataState.data) {
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

      // Also save a minimal version for quick access
      localStorage.setItem('data-labeler-has-data', JSON.stringify({
        sessionId,
        fileName: dataState.fileName,
        dataLength: dataState.data.length,
        hasData: true
      }));
    }
  } catch (error) {
    console.warn('Failed to save state to localStorage:', error);
  }
};

// Load state from a specific session
export const loadStateFromStorage = (sessionId: string | null): {
  dataState: DataState;
  activeTab: 'labeling' | 'report' | 'labels';
  similarRows: any[];
  currentView: 'upload' | 'data';
} | null => {
  try {
    if (!sessionId) return null;

    const storageKey = getSessionStorageKey(sessionId);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const parsed: PersistedState = JSON.parse(stored);

    // Check if the stored version is compatible
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Stored state version mismatch, clearing old state');
      clearStoredState(sessionId);
      return null;
    }

    // Check if state is too old (optional - clear after 7 days)
    const isOld = Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000;
    if (isOld) {
      console.info('Stored state is old, clearing');
      clearStoredState(sessionId);
      return null;
    }

    // Try to deserialize and check if selectedRows is properly restored as a Set
    const deserializedDataState = deserializeState(parsed.dataState);

    // Validate that selectedRows is a Set (fix for corrupted state)
    if (deserializedDataState.selectedRows && typeof deserializedDataState.selectedRows.has !== 'function') {
      console.warn('Corrupted selectedRows detected, clearing stored state');
      clearStoredState(sessionId);
      return null;
    }

    return {
      dataState: deserializedDataState,
      activeTab: parsed.activeTab,
      similarRows: parsed.similarRows,
      currentView: parsed.currentView
    };
  } catch (error) {
    console.warn('Failed to load state from localStorage, clearing corrupted state:', error);
    if (sessionId) clearStoredState(sessionId);
    return null;
  }
};

// Get the active session ID
export const getActiveSessionId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    return null;
  }
};

// Clear a specific session
export const clearStoredState = (sessionId?: string) => {
  try {
    if (sessionId) {
      const storageKey = getSessionStorageKey(sessionId);
      localStorage.removeItem(storageKey);

      // Clear active session if it matches
      const activeSession = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (activeSession === sessionId) {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        localStorage.removeItem('data-labeler-has-data');
      }
    } else {
      // Clear the active session
      const activeSession = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (activeSession) {
        const storageKey = getSessionStorageKey(activeSession);
        localStorage.removeItem(storageKey);
      }
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem('data-labeler-has-data');
    }
  } catch (error) {
    console.warn('Failed to clear stored state:', error);
  }
};

// Check if there's stored data for a session
export const hasStoredData = (sessionId?: string): boolean => {
  try {
    if (sessionId) {
      const storageKey = getSessionStorageKey(sessionId);
      return localStorage.getItem(storageKey) !== null;
    }

    const hasDataInfo = localStorage.getItem('data-labeler-has-data');
    if (!hasDataInfo) return false;

    const parsed = JSON.parse(hasDataInfo);
    return parsed.hasData === true;
  } catch (error) {
    return false;
  }
};

// Interface for session metadata
export interface SessionMetadata {
  sessionId: string;
  fileName: string;
  dataLength: number;
  timestamp: number;
  labeledCount?: number;
  lastModified: string;
}

// Get all available sessions
export const getAllSessions = (): SessionMetadata[] => {
  try {
    const sessions: SessionMetadata[] = [];

    // Iterate through all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const sessionId = key.replace(STORAGE_KEY_PREFIX, '');
        const stored = localStorage.getItem(key);

        if (stored) {
          try {
            const parsed: PersistedState = JSON.parse(stored);

            if (parsed.dataState && parsed.dataState.data) {
              const labeledCount = parsed.dataState.data.filter((row: any) => row.label).length;

              sessions.push({
                sessionId,
                fileName: parsed.dataState.fileName || 'Unknown',
                dataLength: parsed.dataState.data.length,
                timestamp: parsed.timestamp,
                labeledCount,
                lastModified: new Date(parsed.timestamp).toLocaleString()
              });
            }
          } catch (error) {
            console.warn(`Failed to parse session ${sessionId}:`, error);
          }
        }
      }
    }

    // Sort by timestamp (most recent first)
    return sessions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn('Failed to get all sessions:', error);
    return [];
  }
};

// Delete a specific session by ID
export const deleteSession = (sessionId: string): void => {
  clearStoredState(sessionId);
};
