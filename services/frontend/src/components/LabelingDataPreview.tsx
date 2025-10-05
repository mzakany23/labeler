'use client';

import { TransactionData, Label } from '@/types';
import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Tag, Zap } from 'lucide-react';
import { getLabelById } from '@/lib/labelingUtils';

interface LabelingDataPreviewProps {
  data: TransactionData[];
  fileName: string;
  labels: Label[];
  selectedRows: string[]; // Array-based to prevent Set re-render issues
  onRowSelect: (rowId: string, selected: boolean) => void;
  onBulkSelect: (rowIds: string[], selected: boolean) => void;
  onLabelRows: (rowIds: string[], labelId: string) => void;
  onUnlabelRows: (rowIds: string[]) => void;
  onManageRules: (row: TransactionData) => void;
}

export default function LabelingDataPreview({
  data,
  fileName,
  labels,
  selectedRows,
  onRowSelect,
  onBulkSelect,
  onLabelRows,
  onUnlabelRows,
  onManageRules,
}: LabelingDataPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [filterLabel, setFilterLabel] = useState<string>('all');
  const [showLabelDropdown, setShowLabelDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Convert array to Set for O(1) lookups, memoized to prevent recreating on every render
  const selectedRowsSet = useMemo(() => new Set(selectedRows), [selectedRows]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const rowsPerPage = 50;

  // Filter data based on selected label filter
  const filteredData = useMemo(() => {
    if (filterLabel === 'all') return data;
    if (filterLabel === 'unlabeled') return data.filter(row => !row.label);
    if (filterLabel === 'labeled') return data.filter(row => row.label);
    return data.filter(row => row.label === filterLabel);
  }, [data, filterLabel]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
  const currentData = filteredData.slice(startIndex, endIndex);

  const columns = data.length > 0 ? Object.keys(data[0]).filter(col => !['id', 'label', 'labelConfidence'].includes(col)) : [];

  // Calculate labeling statistics
  const labelingStats = useMemo(() => {
    const total = data.length;
    const labeled = data.filter(row => row.label).length;
    const unlabeled = total - labeled;
    const labelCounts = data.reduce((acc, row) => {
      if (row.label) {
        acc[row.label] = (acc[row.label] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      labeled,
      unlabeled,
      completionPercentage: total > 0 ? Math.round((labeled / total) * 100) : 0,
      labelCounts,
    };
  }, [data]);

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  const handleSelectAll = (selected: boolean) => {
    const currentRowIds = currentData.map(row => row.id!).filter(Boolean);
    onBulkSelect(currentRowIds, selected);
  };

  const handleLabelSelected = (labelId: string) => {
    if (selectedRows.length > 0) {
      onLabelRows(selectedRows, labelId);
    }
    setShowLabelDropdown(null);
  };

  const handleUnlabelSelected = () => {
    if (selectedRows.length > 0) {
      onUnlabelRows(selectedRows);
    }
  };

  const currentPageSelectedCount = currentData.filter(row => selectedRowsSet.has(row.id!)).length;
  const allCurrentPageSelected = currentData.length > 0 && currentPageSelectedCount === currentData.length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Labeling Interface</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            File: {fileName} • {filteredData.length.toLocaleString()} rows showing
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="text-lg font-bold text-green-700 dark:text-green-400">{labelingStats.labeled}</div>
            <div className="text-xs text-green-600 dark:text-green-500">Labeled</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{labelingStats.unlabeled}</div>
            <div className="text-xs text-yellow-600 dark:text-yellow-500">Unlabeled</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{labelingStats.completionPercentage}%</div>
            <div className="text-xs text-blue-600 dark:text-blue-500">Complete</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center space-x-4">
        <div className="flex items-center space-x-4">
          {/* Filter */}
          <select
            value={filterLabel}
            onChange={(e) => {
              setFilterLabel(e.target.value);
              setCurrentPage(0);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="all">All Rows ({data.length})</option>
            <option value="labeled">Labeled ({labelingStats.labeled})</option>
            <option value="unlabeled">Unlabeled ({labelingStats.unlabeled})</option>
            {labels.map(label => (
              <option key={label.id} value={label.id}>
                {label.name} ({labelingStats.labelCounts[label.id] || 0})
              </option>
            ))}
          </select>

        </div>

        {/* Bulk Actions */}
        {selectedRows.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedRows.length} selected
            </span>

            <div className="relative">
              <button
                onClick={() => setShowLabelDropdown(showLabelDropdown ? null : 'bulk')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Tag className="h-4 w-4" />
                <span>Label</span>
              </button>

              {showLabelDropdown === 'bulk' && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    {labels.map(label => (
                      <button
                        key={label.id}
                        onClick={() => handleLabelSelected(label.id)}
                        className="flex items-center space-x-3 w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        <span>{label.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleUnlabelSelected}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
              <span>Remove</span>
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Label
                </th>
                {columns.map((column, index) => (
                  <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    {column}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((row, rowIndex) => {
                const rowLabel = row.label ? getLabelById(labels, row.label) : null;
                const isSelected = selectedRowsSet.has(row.id!);

                return (
                  <tr key={row.id || rowIndex} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onRowSelect(row.id!, e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative" ref={showLabelDropdown === `label-${row.id}` ? dropdownRef : undefined}>
                        <button
                          onClick={() => setShowLabelDropdown(showLabelDropdown === `label-${row.id}` ? null : `label-${row.id}`)}
                          className="w-full text-left px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {rowLabel ? (
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: rowLabel.color }}
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {rowLabel.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Click to label</span>
                          )}
                        </button>

                        {showLabelDropdown === `label-${row.id}` && (
                          <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20">
                            <div className="py-1">
                              {/* Remove label option */}
                              {rowLabel && (
                                <>
                                  <button
                                    onClick={() => {
                                      onUnlabelRows([row.id!]);
                                      setShowLabelDropdown(null);
                                    }}
                                    className="flex items-center space-x-3 w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600 dark:text-red-400"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Remove label</span>
                                  </button>
                                  <div className="border-b border-gray-200 dark:border-gray-700"></div>
                                </>
                              )}

                              {/* Label options */}
                              {labels.map(label => (
                                <button
                                  key={label.id}
                                  onClick={() => {
                                    onLabelRows([row.id!], label.id);
                                    setShowLabelDropdown(null);
                                  }}
                                  className={`flex items-center space-x-3 w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                    rowLabel?.id === label.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                  }`}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                  />
                                  <span>{label.name}</span>
                                  {rowLabel?.id === label.id && (
                                    <Check className="w-3 h-3 text-blue-600 ml-auto" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    {columns.map((column, colIndex) => (
                      <td key={colIndex} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {formatValue(row[column])}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex space-x-1">
                    {/* Rule Management button - available for all transactions */}
                    <button
                      onClick={() => onManageRules(row)}
                      className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                      title="Manage rules for this transaction"
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {startIndex + 1} to {endIndex} of {filteredData.length.toLocaleString()} entries
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
