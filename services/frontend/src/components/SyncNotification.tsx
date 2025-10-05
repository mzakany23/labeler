'use client';

import { useEffect, useState } from 'react';
import { Cloud, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export interface SyncNotificationProps {
  message: string;
  type: 'syncing' | 'success' | 'error';
  onClose?: () => void;
  duration?: number;
}

export default function SyncNotification({ 
  message, 
  type, 
  onClose, 
  duration = 3000 
}: SyncNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (type !== 'syncing' && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [type, duration, onClose]);

  if (!isVisible) return null;

  const getConfig = () => {
    switch (type) {
      case 'syncing':
        return {
          icon: <RefreshCw className="h-5 w-5 animate-spin" />,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-700',
          textColor: 'text-blue-800 dark:text-blue-200',
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-700',
          textColor: 'text-green-800 dark:text-green-200',
        };
      case 'error':
        return {
          icon: <XCircle className="h-5 w-5" />,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-700',
          textColor: 'text-red-800 dark:text-red-200',
        };
    }
  };

  const config = getConfig();

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg ${config.bgColor} ${config.borderColor} ${config.textColor}`}>
        {config.icon}
        <span className="text-sm font-medium">{message}</span>
        {type !== 'syncing' && onClose && (
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onClose(), 300);
            }}
            className="ml-2 hover:opacity-70"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
