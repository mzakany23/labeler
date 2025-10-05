'use client';

import { Rule, Label, TransactionData } from '@/types';
import { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Check, Tag, Zap, Eye } from 'lucide-react';
import { rulesApi, recommendationsApi } from '@/lib/apiClient';

// Helper function to safely format dates
const formatDate = (date: any): string => {
  try {
    if (!date) return 'Unknown';

    // If it's already a Date object
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }

    // If it's a string (ISO format from deserialization)
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString();
      }
    }

    // Fallback
    return 'Unknown';
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Unknown';
  }
};

interface RuleManagerProps {
  isOpen: boolean;
  labels: Label[];
  transactions: TransactionData[];
  currentFileId?: string; // File ID for backend API calls
  currentTransaction?: TransactionData; // Transaction that opened the manager
  onClose: () => void;
  onRuleApplied?: (ruleId: string, transactionIds: string[]) => void;
  onPreviewRule?: (rule: Rule) => void;
}

export default function RuleManager({
  isOpen,
  labels,
  transactions,
  currentFileId,
  currentTransaction,
  onClose,
  onRuleApplied,
  onPreviewRule,
}: RuleManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    // Advanced conditions
    conditions: {
      description: '',
      merchant: '',
      amount: {
        min: '',
        max: '',
        exact: '',
      },
      category: '',
      dateRange: {
        start: '',
        end: '',
      },
    },
    // Regex patterns
    regex: {
      description: '',
      merchant: '',
    },
    labelId: '',
    priority: 0,
    isActive: true,
    confidence: 0.5,
    transactionIds: [] as string[],
  });
  const [editRule, setEditRule] = useState({
    name: '',
    description: '',
    // Advanced conditions
    conditions: {
      description: '',
      merchant: '',
      amount: {
        min: '',
        max: '',
        exact: '',
      },
      category: '',
      dateRange: {
        start: '',
        end: '',
      },
    },
    // Regex patterns
    regex: {
      description: '',
      merchant: '',
    },
    labelId: '',
    priority: 0,
    isActive: true,
    confidence: 0.5,
  });

  // Load rules from backend
  useEffect(() => {
    if (isOpen && currentFileId) {
      loadRules();
    }
  }, [isOpen, currentFileId]);

  // Populate edit form when editingRule changes (always runs to maintain hook consistency)
  useEffect(() => {
    if (editingRule && rules.length > 0) {
      const rule = rules.find(r => r.id === editingRule);
      if (rule) {
        setEditRule({
          name: rule.name,
          description: rule.description || '',
          conditions: {
            description: rule.conditions?.description || '',
            merchant: rule.conditions?.merchant || '',
            amount: {
              min: rule.conditions?.amount?.min?.toString() || '',
              max: rule.conditions?.amount?.max?.toString() || '',
              exact: rule.conditions?.amount?.exact?.toString() || '',
            },
            category: rule.conditions?.category || '',
            dateRange: {
              start: rule.conditions?.dateRange?.start || '',
              end: rule.conditions?.dateRange?.end || '',
            },
          },
          regex: {
            description: rule.regex?.description || '',
            merchant: rule.regex?.merchant || '',
          },
          labelId: rule.labelId || '',
          priority: rule.priority,
          isActive: rule.isActive,
          confidence: rule.confidence,
        });
      }
    }
  }, [editingRule, rules]);

  const loadRules = async () => {
    if (!currentFileId) return;

    setIsLoading(true);
    try {
      const response = await rulesApi.list(true); // Load only active rules
      if (response.data) {
        setRules(response.data);
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateRule = async () => {
    if (!currentFileId || !newRule.name.trim()) return;

    try {
      // Convert form data to rule format
      const ruleConditions = {
        ...(newRule.conditions.description && { description: newRule.conditions.description }),
        ...(newRule.conditions.merchant && { merchant: newRule.conditions.merchant }),
        ...(newRule.conditions.category && { category: newRule.conditions.category }),
        ...((newRule.conditions.amount.min || newRule.conditions.amount.max || newRule.conditions.amount.exact) && {
          amount: {
            ...(newRule.conditions.amount.min && { min: Number(newRule.conditions.amount.min) }),
            ...(newRule.conditions.amount.max && { max: Number(newRule.conditions.amount.max) }),
            ...(newRule.conditions.amount.exact && { exact: Number(newRule.conditions.amount.exact) }),
          }
        }),
        ...((newRule.conditions.dateRange.start || newRule.conditions.dateRange.end) && {
          dateRange: {
            ...(newRule.conditions.dateRange.start && { start: newRule.conditions.dateRange.start }),
            ...(newRule.conditions.dateRange.end && { end: newRule.conditions.dateRange.end }),
          }
        }),
      };

      const ruleRegex = {
        ...(newRule.regex.description && { description: newRule.regex.description }),
        ...(newRule.regex.merchant && { merchant: newRule.regex.merchant }),
      };

      const ruleData = {
        name: newRule.name.trim(),
        description: newRule.description.trim() || undefined,
        conditions: ruleConditions,
        regex: ruleRegex,
        labelId: newRule.labelId || undefined,
        priority: newRule.priority,
        isActive: newRule.isActive,
        confidence: newRule.confidence,
      };

      const response = await rulesApi.create(ruleData);
      if (response.data) {
        setRules(prev => [...prev, response.data]);
        setIsCreating(false);

        // Reset form
        setNewRule({
          name: '',
          description: '',
          conditions: {
            description: '',
            merchant: '',
            amount: { min: '', max: '', exact: '' },
            category: '',
            dateRange: { start: '', end: '' },
          },
          regex: { description: '', merchant: '' },
          labelId: '',
          priority: 0,
          isActive: true,
          confidence: 0.5,
          transactionIds: [],
        });
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const handleUpdateRule = async (rule: Rule, updates: Partial<Rule>) => {
    try {
      const response = await rulesApi.update(rule.id, updates);
      if (response.data) {
        setRules(prev => prev.map(r => r.id === rule.id ? response.data : r));
        setEditingRule(null);
      }
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await rulesApi.delete(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handlePreviewRule = async (rule: Rule) => {
    if (!currentFileId || !onPreviewRule) return;

    try {
      const response = await rulesApi.preview(rule.id, currentFileId);
      if (response.data) {
        onPreviewRule(rule);
      }
    } catch (error) {
      console.error('Failed to preview rule:', error);
    }
  };

  const isTransactionInRule = (rule: Rule) => {
    return currentTransaction ? rule.transactionIds.includes(currentTransaction.id!) : false;
  };

  const toggleTransactionInRule = async (rule: Rule) => {
    if (!currentTransaction || !currentFileId) return;

    try {
      if (isTransactionInRule(rule)) {
        // Remove transaction from rule (not directly supported by API, so we'll need to reapply without this transaction)
        await rulesApi.apply(rule.id, currentFileId, []);
      } else {
        // Apply rule to specific transaction
        await rulesApi.apply(rule.id, currentFileId, [currentTransaction.id!]);
      }

      // Refresh rules to get updated state
      await loadRules();

      // Notify parent component
      if (onRuleApplied) {
        onRuleApplied(rule.id, [currentTransaction.id!]);
      }
    } catch (error) {
      console.error('Failed to toggle transaction in rule:', error);
    }
  };

  const getLabelById = (labelId: string | undefined) => {
    return labels.find(l => l.id === labelId);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rule Management</h2>
            {currentTransaction && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Managing rules for: {String(currentTransaction.Description || currentTransaction.description || 'N/A')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Create New Rule Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Rules</h3>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isCreating}
              >
                <Plus className="h-4 w-4" />
                <span>Create Rule</span>
              </button>
            </div>

            {isCreating && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <h4 className="text-md font-medium text-blue-900 dark:text-blue-100 mb-3">Create New Rule</h4>
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="e.g., Starbucks Transactions"
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                        Priority
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newRule.priority}
                        onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newRule.description}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                      placeholder="Optional description"
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>

                  {/* Merchant Condition */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Merchant Pattern
                    </label>
                    <input
                      type="text"
                      value={newRule.conditions.merchant}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, merchant: e.target.value }
                      })}
                      placeholder="e.g., STARBUCKS, AMAZON"
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>

                  {/* Amount Conditions */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Amount Conditions
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={newRule.conditions.amount.exact}
                        onChange={(e) => setNewRule({
                          ...newRule,
                          conditions: {
                            ...newRule.conditions,
                            amount: { ...newRule.conditions.amount, exact: e.target.value }
                          }
                        })}
                        placeholder="Exact amount"
                        className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={newRule.conditions.amount.min}
                        onChange={(e) => setNewRule({
                          ...newRule,
                          conditions: {
                            ...newRule.conditions,
                            amount: { ...newRule.conditions.amount, min: e.target.value }
                          }
                        })}
                        placeholder="Min amount"
                        className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={newRule.conditions.amount.max}
                        onChange={(e) => setNewRule({
                          ...newRule,
                          conditions: {
                            ...newRule.conditions,
                            amount: { ...newRule.conditions.amount, max: e.target.value }
                          }
                        })}
                        placeholder="Max amount"
                        className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  {/* Category Condition */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Category Pattern
                    </label>
                    <input
                      type="text"
                      value={newRule.conditions.category}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, category: e.target.value }
                      })}
                      placeholder="e.g., food, transportation, entertainment"
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>

                  {/* Date Range */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Date Range (Optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={newRule.conditions.dateRange.start}
                        onChange={(e) => setNewRule({
                          ...newRule,
                          conditions: {
                            ...newRule.conditions,
                            dateRange: { ...newRule.conditions.dateRange, start: e.target.value }
                          }
                        })}
                        className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <input
                        type="date"
                        value={newRule.conditions.dateRange.end}
                        onChange={(e) => setNewRule({
                          ...newRule,
                          conditions: {
                            ...newRule.conditions,
                            dateRange: { ...newRule.conditions.dateRange, end: e.target.value }
                          }
                        })}
                        className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  {/* Label Selection */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Auto-apply Label
                    </label>
                    <select
                      value={newRule.labelId}
                      onChange={(e) => setNewRule({ ...newRule, labelId: e.target.value })}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="">No auto-label</option>
                      {labels.map(label => (
                        <option key={label.id} value={label.id}>{label.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Confidence */}
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Confidence Score: {newRule.confidence.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={newRule.confidence}
                      onChange={(e) => setNewRule({ ...newRule, confidence: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div className="flex space-x-3 pt-3">
                    <button
                      onClick={handleCreateRule}
                      disabled={!newRule.name.trim() || isLoading}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-4 w-4" />
                      <span>{isLoading ? 'Creating...' : 'Create'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewRule({
                          name: '',
                          description: '',
                          conditions: {
                            description: '',
                            merchant: '',
                            amount: { min: '', max: '', exact: '' },
                            category: '',
                            dateRange: { start: '', end: '' },
                          },
                          regex: { description: '', merchant: '' },
                          labelId: '',
                          priority: 0,
                          isActive: true,
                          confidence: 0.5,
                          transactionIds: [],
                        });
                      }}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Rule Section */}
            {editingRule && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                <h4 className="text-md font-medium text-green-900 dark:text-green-100 mb-3">Edit Rule</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={editRule.name}
                      onChange={(e) => setEditRule({ ...editRule, name: e.target.value })}
                      placeholder="e.g., Starbucks Transactions"
                      className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                      Pattern *
                    </label>
                    <input
                      type="text"
                      value={editRule.pattern}
                      onChange={(e) => setEditRule({ ...editRule, pattern: e.target.value })}
                      placeholder="e.g., starbucks, amazon, grocery"
                      className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editRule.description}
                      onChange={(e) => setEditRule({ ...editRule, description: e.target.value })}
                      placeholder="Optional description"
                      className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                        Auto-apply Label
                      </label>
                      <select
                        value={editRule.labelId}
                        onChange={(e) => setEditRule({ ...editRule, labelId: e.target.value })}
                        className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">No auto-label</option>
                        {labels.map(label => (
                          <option key={label.id} value={label.id}>{label.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="editRuleActive"
                        checked={editRule.isActive}
                        onChange={(e) => setEditRule({ ...editRule, isActive: e.target.checked })}
                        className="rounded border-green-300 text-green-600 focus:ring-green-500"
                      />
                      <label htmlFor="editRuleActive" className="text-sm font-medium text-green-800 dark:text-green-200">
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        const rule = rules.find(r => r.id === editingRule);
                        if (rule) {
                          handleUpdateRule(rule, editRule);
                        }
                      }}
                      disabled={!editRule.name.trim() || !editRule.pattern.trim()}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                      <Check className="h-4 w-4" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={() => setEditingRule(null)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p>Loading rules...</p>
            </div>
          )}

          {/* Existing Rules */}
          <div className="space-y-3">
            {!isLoading && rules.filter(rule => rule.id !== editingRule).length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No rules created yet</p>
                <p className="text-sm">Create a rule to automatically organize similar transactions</p>
              </div>
            ) : (
              rules.filter(rule => rule.id !== editingRule).map(rule => {
                const label = getLabelById(rule.labelId);
                const inRule = isTransactionInRule(rule);

                return (
                  <div
                    key={rule.id}
                    className={`border rounded-lg p-4 ${
                      inRule
                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</h4>
                          {label && (
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">{label.name}</span>
                            </div>
                          )}
                          {!rule.isActive && (
                            <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pattern: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{rule.pattern}</code>
                        </p>
                        {rule.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{rule.description}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {rule.transactionIds.length} transactions • Created {formatDate(rule.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {currentTransaction && (
                          <button
                            onClick={() => toggleTransactionInRule(rule)}
                            className={`px-3 py-1 text-sm rounded-md ${
                              inRule
                                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}
                          >
                            {inRule ? 'Remove' : 'Apply'}
                          </button>
                        )}
                        {onPreviewRule && (
                          <button
                            onClick={() => handlePreviewRule(rule)}
                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                            title="Preview rule matches"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingRule(rule.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Edit rule"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
