# State Persistence Adapter System

## Overview

The Data Labeler application now features a flexible, adapter-based state persistence system that allows seamless switching between local storage and backend API storage, with automatic fallback and synchronization capabilities.

## Architecture

### Core Components

1. **StateAdapter Interface** (`lib/adapters/types.ts`)
   - Defines the contract that all storage adapters must implement
   - Ensures consistent behavior across different storage backends

2. **LocalStorageAdapter** (`lib/adapters/LocalStorageAdapter.ts`)
   - Implements persistence using browser localStorage
   - Priority: 1 (lower than backend)
   - Always available, no network required

3. **BackendAdapter** (`lib/adapters/BackendAdapter.ts`)
   - Implements persistence using backend API
   - Priority: 10 (higher than localStorage)
   - Requires network connection

4. **StateSync Manager** (`lib/adapters/StateSync.ts`)
   - Coordinates multiple adapters
   - Handles conflict resolution
   - Manages automatic synchronization
   - Provides fallback mechanisms

## Sync Strategies

### Available Strategies

1. **`local-first`** (Default)
   - Saves to localStorage immediately
   - Syncs to backend in the background
   - Best for offline-first applications
   - Ensures no data loss even without internet

2. **`backend-first`**
   - Attempts to save to backend first
   - Falls back to localStorage on failure
   - Best when backend is the source of truth

3. **`hybrid`**
   - Saves to all adapters simultaneously
   - Uses conflict resolution for discrepancies
   - Best for maximum redundancy

4. **`local-only`**
   - Only uses localStorage
   - No network calls
   - Best for development or privacy-focused scenarios

5. **`backend-only`**
   - Only uses backend API
   - No local caching
   - Best when local storage is not desired

### Conflict Resolution

When the same session exists in multiple adapters with different data:

- **`latest-wins`** (Default): Most recent timestamp wins
- **`backend-wins`**: Backend data takes precedence
- **`local-wins`**: Local data takes precedence
- **`merge`**: Attempts to merge changes (future implementation)

## Usage

### Basic Setup

```typescript
import { getStateSync } from '@/lib/adapters';

// Get the global StateSync instance with default settings
const stateSync = getStateSync();

// Or create with custom configuration
const stateSync = getStateSync({
  strategy: 'local-first',
  conflictResolution: 'latest-wins',
  autoSync: true,
  syncInterval: 30000, // 30 seconds
  backendUrl: 'http://localhost:8000/api/v1'
});
```

### Saving State

```typescript
const result = await stateSync.saveState(
  sessionId,
  dataState,
  activeTab,
  'data' // or 'labels' or 'rules'
);

if (result.success) {
  console.log('State saved successfully');
} else {
  console.error('Failed to save:', result.error);
}
```

### Loading State

```typescript
const state = await stateSync.loadState(sessionId);

if (state) {
  console.log('Loaded state:', state.dataState);
  console.log('Active tab:', state.activeTab);
  console.log('Metadata:', state.metadata);
}
```

### Listing Sessions

```typescript
const sessions = await stateSync.listSessions();

sessions.forEach(session => {
  console.log(`Session: ${session.sessionId}`);
  console.log(`File: ${session.fileName}`);
  console.log(`Last modified: ${session.lastModified}`);
  console.log(`Sync status: ${session.syncStatus}`);
});
```

### Manual Sync

```typescript
// Sync all sessions between adapters
await stateSync.syncNow();

// Check sync status for a specific session
const status = await stateSync.getSyncStatus(sessionId);
console.log('Needs sync:', status.needsSync);
status.adapters.forEach(adapter => {
  console.log(`${adapter.name}: ${adapter.synced ? 'synced' : 'not synced'}`);
});
```

### Health Checks

```typescript
const health = await stateSync.healthCheck();

health.forEach((isHealthy, adapterName) => {
  console.log(`${adapterName}: ${isHealthy ? 'healthy' : 'unhealthy'}`);
});
```

## Backend API Endpoints

The backend provides the following session management endpoints:

### Create/Update Session
```
POST /api/v1/sessions/{sessionId}
Body: {
  sessionId: string,
  dataState: object,
  activeTab: string,
  metadata: SessionMetadata,
  type: 'data' | 'labels' | 'rules'
}
```

### Get Session
```
GET /api/v1/sessions/{sessionId}
Response: PersistedState
```

### Delete Session
```
DELETE /api/v1/sessions/{sessionId}
```

### List Sessions
```
GET /api/v1/sessions
Response: SessionMetadata[]
```

### Check Session Exists
```
GET /api/v1/sessions/{sessionId}/exists
Response: { exists: boolean, sessionId: string }
```

### Get/Set Active Session
```
GET /api/v1/sessions/active
Response: { sessionId: string | null }

POST /api/v1/sessions/active
Body: { sessionId: string }
```

### Clear All Sessions
```
DELETE /api/v1/sessions
```

## Migration Guide

### From Old statePersistence.ts

The new system is backward compatible. You can gradually migrate:

```typescript
// Old way
import { saveStateToStorage, loadStateFromStorage } from '@/lib/statePersistence';

// New way (backward compatible wrapper)
import { saveStateToStorage, loadStateFromStorage } from '@/lib/statePersistenceV2';

// Or use the adapter system directly
import { getStateSync } from '@/lib/adapters';
const stateSync = getStateSync();
await stateSync.saveState(sessionId, dataState, activeTab, 'data');
```

## Advanced Features

### Auto-Sync

Auto-sync automatically syncs pending changes to the backend at regular intervals:

```typescript
// Enable auto-sync (enabled by default)
const stateSync = getStateSync({
  autoSync: true,
  syncInterval: 30000 // 30 seconds
});

// Manually control auto-sync
stateSync.stopAutoSync();
stateSync.startAutoSync();
```

### Retry Logic

Failed save operations are automatically retried:

```typescript
const stateSync = getStateSync({
  retryAttempts: 3,
  retryDelay: 5000 // 5 seconds between retries
});
```

### Offline Support

The `local-first` strategy ensures your app works offline:

1. User makes changes → saved to localStorage immediately
2. Changes queued for backend sync
3. When internet returns → automatic sync to backend
4. Conflict resolution if needed

## Best Practices

1. **Use `local-first` for production** - Ensures no data loss
2. **Monitor sync status** - Show users when data is syncing
3. **Handle conflicts gracefully** - Inform users of sync issues
4. **Regular health checks** - Monitor adapter availability
5. **Test offline scenarios** - Ensure app works without internet

## Environment Variables

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Troubleshooting

### Data not syncing to backend

1. Check backend health: `await stateSync.healthCheck()`
2. Check sync status: `await stateSync.getSyncStatus(sessionId)`
3. Manually trigger sync: `await stateSync.syncNow()`

### Conflicts between local and backend

1. Check conflict resolution strategy
2. Review sync status for timestamps
3. Manually resolve by choosing preferred source

### localStorage quota exceeded

1. Clear old sessions: `await stateSync.clearAll()`
2. Implement session cleanup logic
3. Use `backend-first` or `backend-only` strategy

## Future Enhancements

- [ ] Implement merge conflict resolution
- [ ] Add real-time sync with WebSockets
- [ ] Support for IndexedDB adapter
- [ ] Compression for large datasets
- [ ] Encryption for sensitive data
- [ ] Session expiration and cleanup
- [ ] Sync progress indicators
- [ ] Offline queue management UI
