'use client';

import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface SyncStatusIndicatorProps {
  status: 'synced' | 'syncing' | 'offline' | 'error';
  onRetry?: () => void;
}

export default function SyncStatusIndicator({ status, onRetry }: SyncStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return {
          icon: <Check className="h-4 w-4" />,
          text: 'Synced',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          text: 'Syncing...',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        };
      case 'offline':
        return {
          icon: <CloudOff className="h-4 w-4" />,
          text: 'Offline',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Sync Error',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-md ${config.bgColor} ${config.color}`}
      title={status === 'offline' ? 'Saved locally, will sync when online' : undefined}
    >
      {config.icon}
      <span className="text-sm font-medium">{config.text}</span>
      {(status === 'error' || status === 'offline') && onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 text-xs underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
