'use client';

import { useState, useMemo } from 'react';
import { Recommendation } from '@/lib/recommendationEngine';
import { TransactionData, Label } from '@/types';
import { Brain, Zap, CheckCircle, XCircle, TrendingUp, Info, Filter } from 'lucide-react';
import { getLabelById } from '@/lib/labelingUtils';

interface SmartRecommendationsProps {
  recommendations: Recommendation[];
  data: TransactionData[];
  labels: Label[];
  onApplyRecommendation: (recommendation: Recommendation) => void;
  onDismissRecommendation: (recommendationId: string) => void;
  onApplyAllHighConfidence: () => void;
  className?: string;
}

export default function SmartRecommendations({
  recommendations,
  data,
  labels,
  onApplyRecommendation,
  onDismissRecommendation,
  onApplyAllHighConfidence,
  className = ''
}: SmartRecommendationsProps) {
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  // Filter recommendations based on confidence level
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      switch (filterConfidence) {
        case 'high': return rec.confidence >= 0.8;
        case 'medium': return rec.confidence >= 0.6 && rec.confidence < 0.8;
        case 'low': return rec.confidence < 0.6;
        default: return true;
      }
    });
  }, [recommendations, filterConfidence]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = recommendations.length;
    const high = recommendations.filter(r => r.confidence >= 0.8).length;
    const medium = recommendations.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length;
    const low = recommendations.filter(r => r.confidence < 0.6).length;

    return { total, high, medium, low };
  }, [recommendations]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getAlgorithmIcon = (algorithm: Recommendation['algorithm']) => {
    switch (algorithm) {
      case 'exact_match': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fuzzy_match': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'merchant_pattern': return <Info className="h-4 w-4 text-purple-600" />;
      case 'amount_pattern': return <Filter className="h-4 w-4 text-orange-600" />;
      case 'ml_similarity': return <Brain className="h-4 w-4 text-indigo-600" />;
      default: return <Zap className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRowData = (rowId: string) => {
    return data.find(row => row.id === rowId);
  };

  if (recommendations.length === 0) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center ${className}`}>
        <Brain className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Recommendations Available</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Smart recommendations will appear as you label more transactions. The system learns from your labeling patterns.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-purple-600" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Smart Recommendations</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.total} suggestions • {stats.high} high confidence
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Confidence Filter */}
          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="all">All ({stats.total})</option>
            <option value="high">High Confidence ({stats.high})</option>
            <option value="medium">Medium Confidence ({stats.medium})</option>
            <option value="low">Low Confidence ({stats.low})</option>
          </select>

          {/* Apply All High Confidence */}
          {stats.high > 0 && (
            <button
              onClick={onApplyAllHighConfidence}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              <Zap className="h-4 w-4" />
              <span>Apply All High ({stats.high})</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-700 dark:text-green-400">{stats.high}</div>
          <div className="text-xs text-green-600 dark:text-green-500">High Confidence</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{stats.medium}</div>
          <div className="text-xs text-yellow-600 dark:text-yellow-500">Medium Confidence</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-700 dark:text-red-400">{stats.low}</div>
          <div className="text-xs text-red-600 dark:text-red-500">Low Confidence</div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3">
        {filteredRecommendations.map((recommendation) => {
          const label = getLabelById(labels, recommendation.labelId);
          const rowData = getRowData(recommendation.rowId);
          const isExpanded = expandedRec === recommendation.id;

          if (!label || !rowData) return null;

          return (
            <div
              key={recommendation.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  {/* Transaction Info */}
                  <div className="flex items-center space-x-3">
                    {getAlgorithmIcon(recommendation.algorithm)}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {String(rowData.Description || rowData.description || 'Unknown Transaction')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Amount: ${Math.abs(Number(rowData.Amount || rowData.amount || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {label.name}
                      </span>
                    </div>

                    <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(recommendation.confidence)}`}>
                      {getConfidenceLabel(recommendation.confidence)} ({Math.round(recommendation.confidence * 100)}%)
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {recommendation.reason}
                  </div>

                  {/* Matched Transactions (if expanded) */}
                  {isExpanded && recommendation.matchedTransactions.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Similar Transactions ({recommendation.matchedTransactions.length}):
                      </div>
                      <div className="space-y-1">
                        {recommendation.matchedTransactions.slice(0, 3).map((tx, idx) => (
                          <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                            • {String(tx.Description || tx.description || 'Unknown')} -
                            ${Math.abs(Number(tx.Amount || tx.amount || 0)).toLocaleString()}
                          </div>
                        ))}
                        {recommendation.matchedTransactions.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            ... and {recommendation.matchedTransactions.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {recommendation.matchedTransactions.length > 0 && (
                    <button
                      onClick={() => setExpandedRec(isExpanded ? null : recommendation.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Show similar transactions"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onApplyRecommendation(recommendation)}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md"
                    title="Apply this recommendation"
                  >
                    <CheckCircle className="h-5 w-5" />
                  </button>

                  <button
                    onClick={() => onDismissRecommendation(recommendation.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                    title="Dismiss this recommendation"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRecommendations.length === 0 && filterConfidence !== 'all' && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No recommendations match the selected confidence level.
        </div>
      )}
    </div>
  );
}
