'use client';

import { ValidationReport as ValidationReportType } from '@/types';
import { CheckCircle, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';

interface ValidationReportProps {
  report: ValidationReportType;
}

export default function ValidationReport({ report }: ValidationReportProps) {
  const issueCount = report.issues.length;

  const getQualityStatus = () => {
    if (issueCount === 0) return { icon: CheckCircle, text: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800' };
    if (issueCount <= 2) return { icon: AlertTriangle, text: 'Good', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', borderColor: 'border-yellow-200 dark:border-yellow-800' };
    return { icon: XCircle, text: 'Needs Review', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800' };
  };

  const qualityStatus = getQualityStatus();
  const StatusIcon = qualityStatus.icon;

  const missingValueEntries = Object.entries(report.missingValues).filter(([, count]) => count > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BarChart3 className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Quality Report</h2>
      </div>

      {/* Overall Quality Status */}
      <div className={`p-4 rounded-lg border ${qualityStatus.bgColor} ${qualityStatus.borderColor}`}>
        <div className="flex items-center space-x-3">
          <StatusIcon className={`h-6 w-6 ${qualityStatus.color}`} />
          <div>
            <h3 className={`text-lg font-medium ${qualityStatus.color}`}>
              Data Quality: {qualityStatus.text}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {issueCount === 0
                ? 'No data quality issues detected'
                : `${issueCount} issue${issueCount === 1 ? '' : 's'} found`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Issues */}
      {report.issues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-400 mb-3">Issues Found</h3>
          <ul className="space-y-2">
            {report.issues.map((issue, index) => (
              <li key={index} className="flex items-start space-x-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-300">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Overview */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Data Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Rows:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{report.totalRows.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Columns:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{report.totalColumns}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Duplicate Rows:</span>
              <span className={`text-sm font-medium ${report.duplicateRows > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {report.duplicateRows.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Column Types */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Column Types</h4>
            <div className="space-y-2">
              {report.numericColumns.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Numeric ({report.numericColumns.length}):</span>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                    {report.numericColumns.join(', ')}
                  </div>
                </div>
              )}
              {report.dateColumns.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Date ({report.dateColumns.length}):</span>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                    {report.dateColumns.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Missing Values */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Missing Values</h3>
          {missingValueEntries.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">No missing values detected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {missingValueEntries.map(([column, count]) => (
                <div key={column} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{column}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">{count}</span>
                    <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${Math.min((count / report.totalRows) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
