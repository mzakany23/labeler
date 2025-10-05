'use client';

import { useState, useEffect } from 'react';
import { Clock, FileText, Tag, Trash2, FolderOpen } from 'lucide-react';
import { getAllSessions, deleteSession, SessionMetadata } from '@/lib/statePersistenceV2';

interface SessionListProps {
  onSelectSession: (sessionId: string) => void;
}

export default function SessionList({ onSelectSession }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const allSessions = await getAllSessions();
    setSessions(allSessions);
  };

  const handleDeleteSession = async (sessionId: string, fileName: string | null) => {
    if (confirm(`Delete session "${fileName || 'Untitled'}"? This cannot be undone.`)) {
      await deleteSession(sessionId);
      await loadSessions();
    }
  };

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Sessions
            </h3>
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
              {sessions.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Resume your previous work or start fresh with a new upload
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <button
                  onClick={() => onSelectSession(session.sessionId)}
                  className="flex-1 text-left group"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {session.fileName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span>{session.rowCount.toLocaleString()} transactions</span>
                        </span>
                        {session.labelCount > 0 && (
                          <span className="flex items-center space-x-1">
                            <Tag className="h-3 w-3" />
                            <span>
                              {session.labelCount} labels
                            </span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{session.lastModified.toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleDeleteSession(session.sessionId, session.fileName)}
                  className="ml-4 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete session"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
