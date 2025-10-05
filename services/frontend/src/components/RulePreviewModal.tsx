'use client';

import { useState, useEffect } from 'react';
import { TransactionData, Label } from '@/types';
import { RulePreview } from '@/lib/ruleEngine';
import { X, Check, AlertCircle, Eye, EyeOff, Zap, Target, Code } from 'lucide-react';
import { getLabelById } from '@/lib/labelingUtils';

interface RulePreviewModalProps {
  isOpen: boolean;
  rulePreview: RulePreview | null;
  labels: Label[];
  onClose: () => void;
  onApplyRule: (selectedTransactionIds: string[]) => void;
}

export default function RulePreviewModal({
  isOpen,
  rulePreview,
  labels,
  onClose,
  onApplyRule,
}: RulePreviewModalProps) {
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showRegexDetails, setShowRegexDetails] = useState(false);

  // Auto-select all matching transactions when modal opens
  useEffect(() => {
    if (rulePreview) {
      const allIds = new Set(rulePreview.matchingTransactions.map(t => t.id!));
      setSelectedTransactions(allIds);
    }
  }, [rulePreview]);

  if (!isOpen || !rulePreview) return null;

  const label = getLabelById(labels, rulePreview.rule.labelId);
  if (!label) return null;

  const handleToggleTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = new Set(rulePreview.matchingTransactions.map(t => t.id!));
    setSelectedTransactions(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedTransactions(new Set());
  };

  const handleApply = () => {
    onApplyRule(Array.from(selectedTransactions));
    onClose();
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  const confidenceColor = rulePreview.rule.confidence >= 0.8 ? 'text-green-600' :
                         rulePreview.rule.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600';

  const confidenceLabel = rulePreview.rule.confidence >= 0.8 ? 'High' :
                         rulePreview.rule.confidence >= 0.6 ? 'Medium' : 'Low';

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
                  Smart Labeling Rule
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Found {rulePreview.matchingTransactions.length} similar transactions to label
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
                    Rule confidence: <span className={confidenceColor}>{confidenceLabel}</span> ({Math.round(rulePreview.rule.confidence * 100)}%)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRegexDetails(!showRegexDetails)}
                className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Code className="h-4 w-4" />
                <span>{showRegexDetails ? 'Hide' : 'Show'} Pattern Details</span>
              </button>
            </div>

            {/* Regex Pattern Details */}
            {showRegexDetails && (
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Pattern Analysis</h4>

                {rulePreview.rule.patterns.merchant && (
                  <div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Extracted Merchant:</span>
                    <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                      {rulePreview.rule.patterns.merchant}
                    </code>
                  </div>
                )}

                {rulePreview.rule.patterns.description && (
                  <div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Original Transaction:</span>
                    <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs break-all">
                      {rulePreview.rule.patterns.description}
                    </code>
                  </div>
                )}

                {rulePreview.suggestedRegex.merchant && (
                  <div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Merchant Pattern:</span>
                    <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs break-all">
                      {rulePreview.suggestedRegex.merchant}
                    </code>
                  </div>
                )}

                {rulePreview.suggestedRegex.description && (
                  <div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Description Pattern:</span>
                    <code className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs break-all">
                      {rulePreview.suggestedRegex.description}
                    </code>
                  </div>
                )}

                {rulePreview.rule.patterns.amount && (
                  <div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Amount Range:</span>
                    <span className="ml-2 text-sm text-blue-700 dark:text-blue-300">
                      ${rulePreview.rule.patterns.amount.min?.toFixed(2)} - ${rulePreview.rule.patterns.amount.max?.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTransactions.size} of {rulePreview.matchingTransactions.length} transactions selected
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

              {rulePreview.matchingTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No similar transactions found</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {rulePreview.matchingTransactions.map((transaction) => {
                    const isSelected = selectedTransactions.has(transaction.id!);
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
            This will apply the "{label.name}" label to {selectedTransactions.size} transactions
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
              disabled={selectedTransactions.size === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4" />
              <span>Apply Labels ({selectedTransactions.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
