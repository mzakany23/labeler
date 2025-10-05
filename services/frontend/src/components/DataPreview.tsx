'use client';

import { TransactionData } from '@/types';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

interface DataPreviewProps {
  data: TransactionData[];
  fileName: string;
}

export default function DataPreview({ data, fileName }: DataPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const rowsPerPage = 50;

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, data.length);
  const currentData = data.slice(startIndex, endIndex);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Calculate column statistics
  const columnStats = columns.map(col => {
    const nonNullValues = data.filter(row => row[col] !== null && row[col] !== undefined && row[col] !== '');
    const uniqueValues = new Set(nonNullValues.map(row => row[col]));

    return {
      name: col,
      nonNullCount: nonNullValues.length,
      nullCount: data.length - nonNullValues.length,
      uniqueCount: uniqueValues.size,
      type: typeof data.find(row => row[col] !== null)?.[col] || 'unknown'
    };
  });

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Preview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            File: {fileName} • {data.length.toLocaleString()} rows • {columns.length} columns
          </p>
        </div>

        <button
          onClick={() => setShowColumnInfo(!showColumnInfo)}
          className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Info className="h-4 w-4" />
          <span>Column Info</span>
        </button>
      </div>

      {/* Column Information Panel */}
      {showColumnInfo && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Column Information</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Column</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Non-Null</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Null</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Unique</th>
                </tr>
              </thead>
              <tbody>
                {columnStats.map((stat, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 px-3 text-sm font-medium text-gray-900 dark:text-gray-100">{stat.name}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{stat.type}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{stat.nonNullCount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{stat.nullCount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{stat.uniqueCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {columns.map((column, index) => (
                  <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {startIndex + 1} to {endIndex} of {data.length.toLocaleString()} entries
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </button>

            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage + 1} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="flex items-center px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
