'use client';

import { useState, useEffect, useMemo } from 'react';
import { TransactionData, Label, Rule } from '@/types';
import { RulePreview } from '@/lib/ruleEngine';
import { X, Check, AlertCircle, Eye, EyeOff, Zap, Target, Code, Info } from 'lucide-react';
import { getLabelById } from '@/lib/labelingUtils';

interface RulePreviewModalProps {
  isOpen: boolean;
  rulePreview: RulePreview | null;
  rule?: Rule | null; // Enhanced rule format
  matchingTransactions?: TransactionData[]; // For enhanced rule preview
  labels: Label[];
  onClose: () => void;
  onApplyRule: (selectedTransactionIds: string[]) => void;
  onPreviewRule?: (rule: Rule) => void; // For enhanced rule preview
}

export default function RulePreviewModal({
  isOpen,
  rulePreview,
  rule,
  matchingTransactions = [],
  labels,
  onClose,
  onApplyRule,
  onPreviewRule,
}: RulePreviewModalProps) {
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showRegexDetails, setShowRegexDetails] = useState(false);

  // Memoize Set for O(1) lookups
  const selectedTransactionsSet = useMemo(
    () => new Set(selectedTransactionIds),
    [selectedTransactionIds]
  );

  // Auto-select all matching transactions when modal opens
  // Use JSON.stringify to create stable dependency for array comparison
  const matchingTransactionIds = useMemo(
    () => matchingTransactions.map(t => t.id!).join(','),
    [matchingTransactions]
  );
  
  const rulePreviewIds = useMemo(
    () => rulePreview?.matchingTransactions.map(t => t.id!).join(',') || '',
    [rulePreview]
  );

  useEffect(() => {
    if (rulePreview) {
      const allIds = rulePreview.matchingTransactions.map(t => t.id!);
      setSelectedTransactionIds(allIds);
    } else if (rule && matchingTransactions.length > 0) {
      const allIds = matchingTransactions.map(t => t.id!);
      setSelectedTransactionIds(allIds);
    }
    // Use stable string IDs instead of array references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulePreviewIds, matchingTransactionIds, rule?.id]);

  if (!isOpen) return null;

  // Handle both old RulePreview format and new enhanced Rule format
  const currentRule = rulePreview?.rule || rule;
  const currentMatchingTransactions = rulePreview?.matchingTransactions || matchingTransactions;
  const label = currentRule?.labelId ? getLabelById(labels, currentRule.labelId) : null;

  if (!currentRule || !label || (!rulePreview && currentMatchingTransactions.length === 0)) return null;

  const handleToggleTransaction = (transactionId: string) => {
    setSelectedTransactionIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(transactionId)) {
        newSelected.delete(transactionId);
      } else {
        newSelected.add(transactionId);
      }
      return Array.from(newSelected);
    });
  };

  const handleSelectAll = () => {
    const allIds = currentMatchingTransactions.map(t => t.id!);
    setSelectedTransactionIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedTransactionIds([]);
  };

  const handleApply = () => {
    onApplyRule(selectedTransactionIds);
    onClose();
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  const confidenceColor = currentRule.confidence >= 0.8 ? 'text-green-600' :
                         currentRule.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600';

  const confidenceLabel = currentRule.confidence >= 0.8 ? 'High' :
                         currentRule.confidence >= 0.6 ? 'Medium' : 'Low';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Target className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {currentRule.name || 'Rule Preview'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Found {currentMatchingTransactions.length} matching transactions • Priority: {currentRule.priority || 0} • Confidence: {Math.round((currentRule.confidence || 0.5) * 100)}%
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Rule Details */}
          <div className="space-y-6">
            {/* Label and Confidence */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    Apply label: {label.name}
                  </span>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Rule confidence: <span className={confidenceColor}>{confidenceLabel}</span> ({Math.round(currentRule.confidence * 100)}%)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRegexDetails(!showRegexDetails)}
                className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Code className="h-4 w-4" />
                <span>{showRegexDetails ? 'Hide' : 'Show'} Rule Details</span>
              </button>
            </div>

            {/* Rule Details */}
            {showRegexDetails && (
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Rule Conditions</h4>

                {/* Enhanced Rule Conditions */}
                {currentRule.conditions && (
                  <div className="space-y-2">
                    {currentRule.conditions.merchant && (
                      <div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Merchant:</span>
                        <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                          {currentRule.conditions.merchant}
                        </code>
                      </div>
                    )}

                    {currentRule.conditions.description && (
                      <div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Description:</span>
                        <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs break-all">
                          {currentRule.conditions.description}
                        </code>
                      </div>
                    )}

                    {currentRule.conditions.amount && (
                      <div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Amount:</span>
                        <span className="ml-2 text-sm text-blue-700 dark:text-blue-300">
                          {currentRule.conditions.amount.exact !== undefined && `Exact: $${currentRule.conditions.amount.exact}`}
                          {currentRule.conditions.amount.min !== undefined && currentRule.conditions.amount.max !== undefined &&
                            ` $${currentRule.conditions.amount.min} - $${currentRule.conditions.amount.max}`}
                          {currentRule.conditions.amount.min !== undefined && currentRule.conditions.amount.exact === undefined &&
                            `Min: $${currentRule.conditions.amount.min}`}
                          {currentRule.conditions.amount.max !== undefined && currentRule.conditions.amount.exact === undefined &&
                            `Max: $${currentRule.conditions.amount.max}`}
                        </span>
                      </div>
                    )}

                    {currentRule.conditions.category && (
                      <div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Category:</span>
                        <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                          {currentRule.conditions.category}
                        </code>
                      </div>
                    )}

                    {currentRule.conditions.dateRange && (
                      <div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Date Range:</span>
                        <span className="ml-2 text-sm text-blue-700 dark:text-blue-300">
                          {currentRule.conditions.dateRange.start && `From: ${currentRule.conditions.dateRange.start}`}
                          {currentRule.conditions.dateRange.start && currentRule.conditions.dateRange.end && ' to '}
                          {currentRule.conditions.dateRange.end && currentRule.conditions.dateRange.end}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy Pattern Support */}
                {rulePreview && rulePreview.rule.pattern && (
                  <div className="border-t pt-2">
                    <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Pattern:</h5>

                    <div>
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Pattern:</span>
                      <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                        {rulePreview.rule.pattern}
                      </code>
                    </div>

                    {rulePreview.suggestedRegex.merchant && (
                      <div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Merchant Pattern:</span>
                        <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs break-all">
                          {rulePreview.suggestedRegex.merchant}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTransactionIds.length} of {currentMatchingTransactions.length} transactions selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            </div>

            {/* Matching Transactions */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Matching Transactions</h4>

              {currentMatchingTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No matching transactions found</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {currentMatchingTransactions.map((transaction) => {
                    const isSelected = selectedTransactionsSet.has(transaction.id!);
                    const description = String(transaction.Description || transaction.description || '');
                    const amount = Number(transaction.Amount || transaction.amount || 0);
                    const date = String(transaction.Date || transaction.date || '');

                    return (
                      <div
                        key={transaction.id}
                        className={`flex items-center space-x-3 p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => handleToggleTransaction(transaction.id!)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleTransaction(transaction.id!)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {description}
                            </p>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              ${formatValue(amount)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {date}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            This will apply the "{label.name}" label to {selectedTransactionIds.length} transactions
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedTransactionIds.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4" />
              <span>Apply Labels ({selectedTransactionIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
