'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DataState, Label, LabelGroup, LabelingAction, TransactionData, Rule } from '@/types';
import {
  saveStateToStorage,
  loadStateFromStorage,
  clearStoredState,
  hasStoredData,
  generateSessionId,
  getActiveSessionId
} from '@/lib/statePersistence';

// Component works! Now restoring the main app
import { processCsvFile } from '@/lib/csvProcessor';
import {
  createDefaultLabels,
  generateId,
  createLabelingAction,
  applyLabel,
  removeLabel,
  updateLabelUsage
} from '@/lib/labelingUtils';
import { createRulePreview, applyRule } from '@/lib/ruleEngine';
import {
  createRule,
  updateRule,
  addTransactionToRule,
  removeTransactionFromRule,
  suggestPatternFromTransaction,
  applyRuleToTransactions,
  reapplyRulesForLabel,
  reapplyRule,
  reapplyAllRules
} from '@/lib/ruleUtils';
import {
  createLabelGroup,
  updateLabelGroupUsage,
  getGroupById,
  getLabelsInGroup
} from '@/lib/labelingUtils';
import {
  generateRecommendations,
  type Recommendation
} from '@/lib/recommendationEngine';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import ValidationReport from '@/components/ValidationReport';
import LabelManager from '@/components/LabelManager';
import LabelingDataPreview from '@/components/LabelingDataPreview';
import RulePreviewModal from '@/components/RulePreviewModal';
import RuleManager from '@/components/RuleManager';
import { Tag, FileSpreadsheet, TrendingUp, Undo, Redo } from 'lucide-react';
import SessionList from '@/components/SessionList';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize state with default values (server-safe)
  const [dataState, setDataState] = useState<DataState>({
    data: null,
    fileName: null,
    validationReport: null,
    isLoading: false,
    labels: createDefaultLabels(),
    labelGroups: [],
    selectedRows: new Set<string>(),
    actionHistory: [],
    currentHistoryIndex: -1,
    isLabelingMode: false,
    recommendations: [],
    isGeneratingRecommendations: false,
    dismissedRecommendations: new Set<string>(),
    rulePreview: null,
    isRuleModalOpen: false,
    rules: [], // New rules state
    isRuleManagerOpen: false, // New rule manager modal state
  });

  const [activeTab, setActiveTab] = useState<'labeling' | 'report' | 'labels'>('labeling');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted state on client-side only (prevents hydration errors)
  useEffect(() => {
    const urlSessionId = searchParams.get('session');

    if (urlSessionId) {
      // Load state from URL session ID
      setSessionId(urlSessionId);
      const persisted = loadStateFromStorage(urlSessionId);

      if (persisted) {
        setDataState(persisted.dataState);
        setActiveTab(persisted.activeTab);
      }
    } else {
      // No session in URL, check if there's an active session
      const activeSession = getActiveSessionId();
      if (activeSession) {
        // Redirect to the active session
        router.replace(`/?session=${activeSession}`);
        return;
      }
    }

    setIsLoaded(true);
  }, [searchParams, router]);

  // Update URL when session or data changes
  useEffect(() => {
    if (!isLoaded) return;

    if (dataState.data && sessionId) {
      // Ensure URL reflects current session
      const urlSessionId = searchParams.get('session');
      if (urlSessionId !== sessionId) {
        router.replace(`/?session=${sessionId}`, { scroll: false });
      }
    } else if (!dataState.data && sessionId) {
      // Data was cleared, but we still have a session ID
      const urlSessionId = searchParams.get('session');
      if (urlSessionId === sessionId) {
        // Clear the URL
        router.replace('/', { scroll: false });
      }
    }
  }, [dataState.data, sessionId, isLoaded, router, searchParams]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded && sessionId) {
      saveStateToStorage(sessionId, dataState, activeTab, 'data');
    }
  }, [dataState, activeTab, isLoaded, sessionId]);

  const handleFileUpload = async (file: File) => {
    setDataState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, report } = await processCsvFile(file);

      // Generate a new session ID for this upload
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);

      setDataState(prev => ({
        ...prev,
        data,
        fileName: file.name,
        validationReport: report,
        isLoading: false,
        selectedRows: new Set<string>(),
        actionHistory: [],
        currentHistoryIndex: -1,
        recommendations: [],
        dismissedRecommendations: new Set<string>(),
      }));

      // Navigate to new session URL
      router.push(`/?session=${newSessionId}`);
    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDataState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const resetData = () => {
    // Don't clear the session from storage - just reset the UI state
    // This allows the session list to still show the session
    // But DO clear the active session marker so we don't auto-redirect
    if (sessionId) {
      // Clear just the active session marker, not the session data
      localStorage.removeItem('data-labeler-active-session');
      localStorage.removeItem('data-labeler-has-data');
    }

    setDataState(prev => ({
      ...prev,
      data: null,
      fileName: null,
      validationReport: null,
      isLoading: false,
      selectedRows: new Set<string>(),
      actionHistory: [],
      currentHistoryIndex: -1,
      isLabelingMode: false,
    }));
    setActiveTab('labeling');
    setSessionId(null);
    router.push('/');
  };

  const clearSessionAndReset = () => {
    if (sessionId) {
      clearStoredState(sessionId); // Actually delete the session from storage
    }
    resetData();
  };

  const goToData = () => {
    if (dataState.data && sessionId) {
      router.push(`/?session=${sessionId}`);
    }
  };

  const handleSelectSession = (selectedSessionId: string) => {
    router.push(`/?session=${selectedSessionId}`);
  };

  // Labeling functions
  const addToHistory = useCallback((action: LabelingAction) => {
    setDataState(prev => {
      const newHistory = prev.actionHistory.slice(0, prev.currentHistoryIndex + 1);
      newHistory.push(action);
      return {
        ...prev,
        actionHistory: newHistory,
        currentHistoryIndex: newHistory.length - 1,
      };
    });
  }, []);

  const handleRowSelect = useCallback((rowId: string, selected: boolean) => {
    setDataState(prev => {
      const newSelectedRows = new Set(prev.selectedRows);
      if (selected) {
        newSelectedRows.add(rowId);
      } else {
        newSelectedRows.delete(rowId);
      }
      return { ...prev, selectedRows: newSelectedRows };
    });
  }, []);

  const handleBulkSelect = useCallback((rowIds: string[], selected: boolean) => {
    setDataState(prev => {
      const newSelectedRows = new Set(prev.selectedRows);
      rowIds.forEach(rowId => {
        if (selected) {
          newSelectedRows.add(rowId);
        } else {
          newSelectedRows.delete(rowId);
        }
      });
      return { ...prev, selectedRows: newSelectedRows };
    });
  }, []);

  const handleLabelRows = useCallback((rowIds: string[], labelId: string, skipRuleCreation = false) => {
    if (!dataState.data) return;

    const previousLabels = rowIds.reduce((acc, rowId) => {
      const row = dataState.data?.find(r => r.id === rowId);
      if (row?.label) acc[rowId] = row.label;
      return acc;
    }, {} as Record<string, string>);

    const action = createLabelingAction('label', rowIds, labelId, undefined, { previousLabels });

    // Store rule suggestion for later use (removed auto-popup)
    if (!skipRuleCreation && rowIds.length === 1) {
      const labeledTransaction = dataState.data.find(t => t.id === rowIds[0]);
      const label = dataState.labels.find(l => l.id === labelId);

      if (labeledTransaction && label) {
        const rulePreview = createRulePreview(labeledTransaction, label, dataState.data);

        // Store rule preview but don't auto-show modal
        if (rulePreview.matchingTransactions.length > 0) {
          setDataState(prev => ({
            ...prev,
            data: prev.data ? applyLabel(prev.data, rowIds, labelId) : null,
            labels: updateLabelUsage(prev.labels, labelId, rowIds.length),
            selectedRows: new Set<string>(),
            rulePreview, // Store for potential use
            isRuleModalOpen: false, // Don't auto-open
          }));

          addToHistory(action);
          return;
        }
      }
    }

    setDataState(prev => ({
      ...prev,
      data: prev.data ? applyLabel(prev.data, rowIds, labelId) : null,
      labels: updateLabelUsage(prev.labels, labelId, rowIds.length),
      selectedRows: new Set<string>(),
    }));

    addToHistory(action);
  }, [dataState.data, dataState.labels, addToHistory]);

  const handleUnlabelRows = useCallback((rowIds: string[]) => {
    if (!dataState.data) return;

    const previousLabels = rowIds.reduce((acc, rowId) => {
      const row = dataState.data?.find(r => r.id === rowId);
      if (row?.label) acc[rowId] = row.label;
      return acc;
    }, {} as Record<string, string>);

    const action = createLabelingAction('unlabel', rowIds, undefined, undefined, { previousLabels });

    setDataState(prev => ({
      ...prev,
      data: prev.data ? removeLabel(prev.data, rowIds) : null,
      selectedRows: new Set<string>(),
    }));

    addToHistory(action);
  }, [dataState.data, addToHistory]);

  // Label management functions
  const handleCreateLabel = useCallback((labelData: Omit<Label, 'id' | 'createdAt' | 'usageCount'>) => {
    const newLabel: Label = {
      ...labelData,
      id: generateId(),
      createdAt: new Date(),
      usageCount: 0,
    };

    setDataState(prev => ({
      ...prev,
      labels: [...prev.labels, newLabel],
    }));
  }, []);

  const handleUpdateLabel = useCallback((labelId: string, updates: Partial<Label>) => {
    setDataState(prev => {
      const oldLabel = prev.labels.find(l => l.id === labelId);
      const updatedLabels = prev.labels.map(label =>
        label.id === labelId ? { ...label, ...updates } : label
      );

      // Update group label lists if group assignment changed
      let updatedGroups = prev.labelGroups;
      if (updates.group !== undefined && oldLabel) {
        // Remove from old group
        if (oldLabel.group) {
          const oldGroup = prev.labelGroups.find(g => g.id === oldLabel.group);
          if (oldGroup) {
            updatedGroups = updatedGroups.map(group =>
              group.id === oldLabel.group
                ? { ...group, labels: group.labels.filter(id => id !== labelId) }
                : group
            );
          }
        }

        // Add to new group
        if (updates.group) {
          const newGroup = prev.labelGroups.find(g => g.id === updates.group);
          if (newGroup) {
            updatedGroups = updatedGroups.map(group =>
              group.id === updates.group
                ? { ...group, labels: [...group.labels, labelId] }
                : group
            );
          }
        }
      }

      // Reapply all rules that reference this label to find new matches
      if (prev.data && prev.rules.length > 0) {
        const updatedRules = reapplyRulesForLabel(prev.rules, labelId, prev.data);

        return {
          ...prev,
          labels: updatedLabels,
          labelGroups: updatedGroups,
          rules: updatedRules,
        };
      }

      return {
        ...prev,
        labels: updatedLabels,
        labelGroups: updatedGroups,
      };
    });
  }, []);

  const handleDeleteLabel = useCallback((labelId: string) => {
    if (!confirm('Are you sure you want to delete this label? This will remove it from all transactions.')) {
      return;
    }

    setDataState(prev => {
      const labelToDelete = prev.labels.find(l => l.id === labelId);
      let updatedGroups = prev.labelGroups;

      // Remove label from its group
      if (labelToDelete?.group) {
        updatedGroups = updatedGroups.map(group =>
          group.id === labelToDelete.group
            ? { ...group, labels: group.labels.filter(id => id !== labelId) }
            : group
        );
      }

      return {
        ...prev,
        labels: prev.labels.filter(label => label.id !== labelId),
        labelGroups: updatedGroups,
        data: prev.data ? prev.data.map(row => {
          if (row.label === labelId) {
            const { label, labelConfidence, ...rest } = row;
            return rest;
          }
          return row;
        }      ) : null,
      };
    });
  }, []);

  // Group management functions
  const handleCreateGroup = useCallback((groupData: Omit<LabelGroup, 'id'>) => {
    const newGroup: LabelGroup = {
      ...groupData,
      id: generateId(),
    };

    setDataState(prev => ({
      ...prev,
      labelGroups: [...prev.labelGroups, newGroup],
    }));
  }, []);

  const handleUpdateGroup = useCallback((groupId: string, updates: Partial<LabelGroup>) => {
    setDataState(prev => ({
      ...prev,
      labelGroups: prev.labelGroups.map(group =>
        group.id === groupId ? { ...group, ...updates } : group
      ),
    }));
  }, []);

  const handleDeleteGroup = useCallback((groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? Labels in this group will become ungrouped.')) {
      return;
    }

    setDataState(prev => {
      const groupToDelete = prev.labelGroups.find(g => g.id === groupId);
      if (!groupToDelete) return prev;

      // Remove group from all labels that belong to it
      const updatedLabels = prev.labels.map(label => {
        if (label.group === groupId) {
          const { group, ...rest } = label;
          return rest;
        }
        return label;
      });

      return {
        ...prev,
        labelGroups: prev.labelGroups.filter(group => group.id !== groupId),
        labels: updatedLabels,
      };
    });
  }, []);

  // Recommendation functions
  const generateSmartRecommendations = useCallback(async () => {
    if (!dataState.data || dataState.data.length === 0) return;

    setDataState(prev => ({ ...prev, isGeneratingRecommendations: true }));

    try {
      const labeledData = dataState.data.filter(row => row.label);
      const unlabeledData = dataState.data.filter(row => !row.label && !dataState.dismissedRecommendations.has(row.id!));

      if (labeledData.length === 0 || unlabeledData.length === 0) {
        setDataState(prev => ({
          ...prev,
          recommendations: [],
          isGeneratingRecommendations: false
        }));
        return;
      }

      // Generate recommendations using our ML engine
      const recommendations = generateRecommendations(unlabeledData, labeledData, dataState.labels);

      setDataState(prev => ({
        ...prev,
        recommendations,
        isGeneratingRecommendations: false,
      }));
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setDataState(prev => ({ ...prev, isGeneratingRecommendations: false }));
    }
  }, [dataState.data, dataState.labels, dataState.dismissedRecommendations]);

  const handleApplyRecommendation = useCallback((recommendation: Recommendation) => {
    handleLabelRows([recommendation.rowId], recommendation.labelId, true); // Skip rule creation for recommendations

    // Remove the applied recommendation from the list
    setDataState(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((r: Recommendation) => r.id !== recommendation.id),
    }));
  }, [handleLabelRows]);

  const handleDismissRecommendation = useCallback((recommendationId: string) => {
    setDataState(prev => {
      const recommendation = prev.recommendations.find((r: Recommendation) => r.id === recommendationId);
      const newDismissed = new Set(prev.dismissedRecommendations);

      if (recommendation) {
        newDismissed.add(recommendation.rowId);
      }

      return {
        ...prev,
        recommendations: prev.recommendations.filter((r: Recommendation) => r.id !== recommendationId),
        dismissedRecommendations: newDismissed,
      };
    });
  }, []);

  const handleApplyAllHighConfidence = useCallback(() => {
    const highConfidenceRecs = dataState.recommendations.filter((rec: Recommendation) => rec.confidence >= 0.8);

    if (highConfidenceRecs.length === 0) return;

    // Group by label for bulk operations
    const labelGroups = highConfidenceRecs.reduce((acc, rec) => {
      if (!acc[rec.labelId]) acc[rec.labelId] = [];
      acc[rec.labelId].push(rec.rowId);
      return acc;
    }, {} as Record<string, string[]>);

    // Apply all high confidence recommendations
    Object.entries(labelGroups).forEach(([labelId, rowIds]) => {
      handleLabelRows(rowIds as string[], labelId, true); // Skip rule creation for bulk recommendations
    });

    // Remove applied recommendations
    const appliedIds = new Set(highConfidenceRecs.map(rec => rec.id));
    setDataState(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((r: Recommendation) => !appliedIds.has(r.id)),
    }));
  }, [dataState.recommendations, handleLabelRows]);

  // Rule handling functions
  const handleCloseRuleModal = useCallback(() => {
    setDataState(prev => ({
      ...prev,
      rulePreview: null,
      isRuleModalOpen: false,
    }));
  }, []);

  const handleCreateRule = useCallback((transaction: TransactionData) => {
    if (!dataState.data || !transaction.label) return;

    const label = dataState.labels.find(l => l.id === transaction.label);
    if (!label) return;

    const rulePreview = createRulePreview(transaction, label, dataState.data);

    if (rulePreview.matchingTransactions.length > 0) {
      setDataState(prev => ({
        ...prev,
        rulePreview,
        isRuleModalOpen: true,
      }));
    }
  }, [dataState.data, dataState.labels]);

  // New rule management handlers
  const handleManageRules = useCallback((transaction: TransactionData) => {
    setDataState(prev => ({
      ...prev,
      isRuleManagerOpen: true,
      currentTransaction: transaction, // Store the current transaction context
    }));
  }, []);

  const handleCloseRuleManager = useCallback(() => {
    setDataState(prev => ({
      ...prev,
      isRuleManagerOpen: false,
      currentTransaction: undefined,
    }));
  }, []);

  const handleCreateNewRule = useCallback((ruleData: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!dataState.data) return;

    // Create the rule
    const newRule = createRule(
      ruleData.name,
      ruleData.pattern,
      ruleData.description,
      ruleData.labelId,
      ruleData.transactionIds
    );

    // Apply the rule to find matching transactions
    const ruleWithMatches = applyRuleToTransactions(newRule, dataState.data);

    // If rule has an auto-label, apply it to matching transactions
    const updatedData = ruleData.labelId ? dataState.data.map(transaction => {
      if (ruleWithMatches.transactionIds.includes(transaction.id!)) {
        return {
          ...transaction,
          label: ruleData.labelId,
          labelConfidence: 0.9 // High confidence for rule-based labeling
        };
      }
      return transaction;
    }) : dataState.data;

    setDataState(prev => ({
      ...prev,
      data: updatedData,
      rules: [...prev.rules, ruleWithMatches],
    }));

    console.log(`Rule "${ruleData.name}" created and applied to ${ruleWithMatches.transactionIds.length} transactions`);
  }, [dataState.data]);

  const handleUpdateRule = useCallback((ruleId: string, updates: Partial<Rule>) => {
    setDataState(prev => {
      const updatedRules = prev.rules.map(rule =>
        rule.id === ruleId ? updateRule(rule, updates) : rule
      );

      // If the rule was updated and is active, reapply it to find new matches
      if (prev.data) {
        const updatedRule = updatedRules.find(r => r.id === ruleId);
        if (updatedRule && updatedRule.isActive) {
          const reappliedRule = reapplyRule(updatedRule, prev.data);
          return {
            ...prev,
            rules: updatedRules.map(rule =>
              rule.id === ruleId ? reappliedRule : rule
            ),
          };
        }
      }

      return {
        ...prev,
        rules: updatedRules,
      };
    });
  }, []);

  const handleReapplyAllRules = useCallback(() => {
    if (!dataState.data) return;

    setDataState(prev => ({
      ...prev,
      rules: reapplyAllRules(prev.rules, prev.data),
    }));
  }, [dataState.data]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    setDataState(prev => ({
      ...prev,
      rules: prev.rules.filter(rule => rule.id !== ruleId),
    }));
  }, []);

  const handleApplyRuleToTransaction = useCallback((ruleId: string, transactionId: string) => {
    setDataState(prev => {
      const rule = prev.rules.find(r => r.id === ruleId);
      if (!rule || !prev.data) return prev;

      // Update the rule with the new transaction
      const updatedRules = prev.rules.map(rule =>
        rule.id === ruleId ? addTransactionToRule(rule, transactionId) : rule
      );

      // If rule has an auto-label, apply it to the transaction
      const updatedData = rule.labelId ? prev.data.map(transaction => {
        if (transaction.id === transactionId) {
          return {
            ...transaction,
            label: rule.labelId,
            labelConfidence: 0.9 // High confidence for rule-based labeling
          };
        }
        return transaction;
      }) : prev.data;

      return {
        ...prev,
        data: updatedData,
        rules: updatedRules,
      };
    });
  }, []);

  const handleRemoveTransactionFromRule = useCallback((ruleId: string, transactionId: string) => {
    setDataState(prev => {
      const rule = prev.rules.find(r => r.id === ruleId);
      if (!rule || !prev.data) return prev;

      // Update the rule to remove the transaction
      const updatedRules = prev.rules.map(rule =>
        rule.id === ruleId ? removeTransactionFromRule(rule, transactionId) : rule
      );

      // If rule has an auto-label, consider removing it from the transaction
      // (Only remove if no other rules are applying the same label)
      const updatedData = rule.labelId ? prev.data.map(transaction => {
        if (transaction.id === transactionId && transaction.label === rule.labelId) {
          // Check if any other rules still apply this label to this transaction
          const otherRulesWithSameLabel = prev.rules.filter(r =>
            r.id !== ruleId &&
            r.labelId === rule.labelId &&
            r.transactionIds.includes(transactionId)
          );

          if (otherRulesWithSameLabel.length === 0) {
            // No other rules apply this label, so remove it
            const { label, labelConfidence, ...transactionWithoutLabel } = transaction;
            return transactionWithoutLabel;
          }
        }
        return transaction;
      }) : prev.data;

      return {
        ...prev,
        data: updatedData,
        rules: updatedRules,
      };
    });
  }, []);

  const handleApplyRule = useCallback((selectedTransactionIds: string[]) => {
    if (!dataState.rulePreview || !dataState.data) return;

    const rule = dataState.rulePreview.rule;
    const labeledTransactions = applyRule(rule, dataState.data, selectedTransactionIds);

    // Update the transactions with the new labels
    setDataState(prev => {
      if (!prev.data) return prev;

      const updatedData = prev.data.map(transaction => {
        const labeledTransaction = labeledTransactions.find(lt => lt.id === transaction.id);
        return labeledTransaction || transaction;
      });

      const action = createLabelingAction('bulk_label', selectedTransactionIds, rule.labelId);

      return {
        ...prev,
        data: updatedData,
        labels: updateLabelUsage(prev.labels, rule.labelId, selectedTransactionIds.length),
        rulePreview: null,
        isRuleModalOpen: false,
      };
    });

    // Create history action
    const action = createLabelingAction('bulk_label', selectedTransactionIds, dataState.rulePreview.rule.labelId);
    addToHistory(action);
  }, [dataState.rulePreview, dataState.data, addToHistory]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Logo/Title - Always clickable to go home */}
              <button
                onClick={resetData}
                className="flex items-center space-x-3 hover:opacity-80 transition-colors"
                title="Go to home"
              >
                <Tag className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Labeler</h1>
                </div>
              </button>

              {/* Breadcrumb */}
              {dataState.data && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span className="mx-2">/</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {dataState.fileName || 'Uploaded Data'}
                  </span>
                  <span className="mx-2">•</span>
                  <span>{dataState.data.length} transactions</span>
                  {sessionId && hasStoredData(sessionId) && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="text-green-600 dark:text-green-400 text-xs">Auto-saved</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {sessionId && hasStoredData(sessionId) && dataState.data && (
                <button
                  onClick={() => {
                    if (confirm('Clear all saved data for this session? This cannot be undone.')) {
                      clearSessionAndReset();
                    }
                  }}
                  className="px-3 py-1 text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 border border-orange-300 dark:border-orange-600 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  title="Clear all saved data from browser storage"
                >
                  Clear Saved Data
                </button>
              )}
              {dataState.data && dataState.rules.length > 0 && (
                <button
                  onClick={handleReapplyAllRules}
                  className="px-3 py-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-600 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  title="Reapply all rules to find new matches"
                >
                  Reapply Rules
                </button>
              )}
              {dataState.data && (
                <button
                  onClick={resetData}
                  className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Upload New File
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!dataState.data ? (
          /* Upload Section */
          <div className="text-center space-y-8">
            {/* Existing Data Notice - Never shown since this view only appears without data */}
            {false && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="flex items-center justify-center space-x-3">
                  <Tag className="h-5 w-5 text-blue-600" />
                  <div className="text-center">
                    <div className="text-blue-800 dark:text-blue-200">
                      You have loaded data: <strong>{dataState.fileName || 'Uploaded Data'}</strong> ({dataState.data.length} transactions)
                    </div>
                    {hasStoredData() && (
                      <div className="text-green-700 dark:text-green-300 text-sm mt-1">
                        ✓ Auto-restored from previous session
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={goToData}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Return to Data Labeling
                </button>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {dataState.data ? 'Upload New Financial Data' : 'Upload Your Financial Data'}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                {dataState.data
                  ? 'Upload a new CSV file to replace your current data. Your existing data will be lost.'
                  : 'Get started by uploading a CSV file containing your financial transaction data. We\'ll analyze it for quality and help you prepare for labeling.'
                }
              </p>
            </div>

            <FileUpload onFileUpload={handleFileUpload} isLoading={dataState.isLoading} />

            {/* Recent Sessions */}
            {!dataState.isLoading && (
              <SessionList onSelectSession={handleSelectSession} />
            )}

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
              <div className="text-center p-6">
                <FileSpreadsheet className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Smart CSV Processing</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Automatic detection of data types, financial columns, and encoding issues
                </p>
              </div>
              <div className="text-center p-6">
                <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Data Quality Reports</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Comprehensive validation with missing values and duplicate detection
                </p>
              </div>
              <div className="text-center p-6">
                <Tag className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Precise Labeling</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Hand-label transactions with confidence for perfect categorization
                </p>
              </div>
            </div>
            </div>
        ) : dataState.data ? (
          /* Data Display Section */
          <div className="space-y-6">
            {/* Success Message */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <span className="text-green-800 dark:text-green-400 font-medium">
                  Successfully loaded: {dataState.fileName}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('labeling')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'labeling'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  Label Data
                </button>
                <button
                  onClick={() => setActiveTab('report')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'report'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  Quality Report
                </button>
                <button
                  onClick={() => setActiveTab('labels')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'labels'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  Manage Labels
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'labeling' && (
                <div className="space-y-6">

                  {/* Similar Transactions Notice */}
                  {/* Data Labeling Interface */}
                  <LabelingDataPreview
                    data={dataState.data}
                    fileName={dataState.fileName!}
                    labels={dataState.labels}
                    selectedRows={dataState.selectedRows}
                    onRowSelect={handleRowSelect}
                    onBulkSelect={handleBulkSelect}
                    onLabelRows={handleLabelRows}
                    onUnlabelRows={handleUnlabelRows}
                    onManageRules={handleManageRules}
                  />
                </div>
              )}
              {activeTab === 'report' && dataState.validationReport && (
                <ValidationReport report={dataState.validationReport} />
              )}
              {activeTab === 'labels' && (
                <LabelManager
                  labels={dataState.labels}
                  labelGroups={dataState.labelGroups}
                  onCreateLabel={handleCreateLabel}
                  onUpdateLabel={handleUpdateLabel}
                  onDeleteLabel={handleDeleteLabel}
                  onCreateGroup={handleCreateGroup}
                  onUpdateGroup={handleUpdateGroup}
                  onDeleteGroup={handleDeleteGroup}
                />
              )}
            </div>
            </div>
          ) : (
            /* Fallback - should not normally be reached */
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400">No data available. Please upload a file.</p>
            </div>
          )}
        </main>

      {/* Rule Preview Modal */}
      <RulePreviewModal
        isOpen={dataState.isRuleModalOpen}
        rulePreview={dataState.rulePreview}
        labels={dataState.labels}
        onClose={handleCloseRuleModal}
        onApplyRule={handleApplyRule}
      />

      {/* Rule Manager Modal */}
      <RuleManager
        isOpen={dataState.isRuleManagerOpen}
        rules={dataState.rules}
        labels={dataState.labels}
        transactions={dataState.data || []}
        currentTransaction={dataState.currentTransaction}
        onClose={handleCloseRuleManager}
        onCreateRule={handleCreateNewRule}
        onUpdateRule={handleUpdateRule}
        onDeleteRule={handleDeleteRule}
        onApplyRuleToTransaction={handleApplyRuleToTransaction}
        onRemoveTransactionFromRule={handleRemoveTransactionFromRule}
      />
    </div>
  );
}
