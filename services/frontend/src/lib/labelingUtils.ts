import { TransactionData, Label, LabelGroup, LabelingAction } from '@/types';

// Predefined label colors
export const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#dc2626', // red-600
  '#ea580c', // orange-600
  '#ca8a04', // yellow-600
];

// Default financial categories
export const DEFAULT_LABELS: Omit<Label, 'id' | 'createdAt' | 'usageCount'>[] = [
  { name: 'Food & Dining', color: '#ef4444', description: 'Restaurants, groceries, food delivery' },
  { name: 'Transportation', color: '#f97316', description: 'Gas, public transit, rideshare, parking' },
  { name: 'Shopping', color: '#eab308', description: 'Retail purchases, online shopping' },
  { name: 'Bills & Utilities', color: '#22c55e', description: 'Electricity, water, internet, phone' },
  { name: 'Healthcare', color: '#06b6d4', description: 'Medical expenses, pharmacy, insurance' },
  { name: 'Entertainment', color: '#3b82f6', description: 'Movies, games, subscriptions, hobbies' },
  { name: 'Income', color: '#8b5cf6', description: 'Salary, freelance, investments' },
  { name: 'Transfer', color: '#ec4899', description: 'Account transfers, payments' },
  { name: 'Fees', color: '#64748b', description: 'Bank fees, service charges' },
  { name: 'Other', color: '#dc2626', description: 'Uncategorized transactions' },
];

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function createDefaultLabels(): Label[] {
  return DEFAULT_LABELS.map(label => ({
    ...label,
    id: generateId(),
    createdAt: new Date(),
    usageCount: 0,
  }));
}

export function assignRowIds(data: TransactionData[]): TransactionData[] {
  return data.map((row, index) => ({
    ...row,
    id: row.id || `row_${index}_${generateId()}`,
  }));
}

export function createLabelingAction(
  type: LabelingAction['type'],
  rowIds: string[],
  labelId?: string,
  previousLabelId?: string,
  data?: any
): LabelingAction {
  return {
    id: generateId(),
    type,
    timestamp: new Date(),
    rowIds,
    labelId,
    previousLabelId,
    data,
  };
}

export function applyLabel(
  data: TransactionData[],
  rowIds: string[],
  labelId: string
): TransactionData[] {
  return data.map(row => {
    if (row.id && rowIds.includes(row.id)) {
      return {
        ...row,
        label: labelId,
        labelConfidence: 1.0, // Manual labeling has full confidence
      };
    }
    return row;
  });
}

export function removeLabel(
  data: TransactionData[],
  rowIds: string[]
): TransactionData[] {
  return data.map(row => {
    if (row.id && rowIds.includes(row.id)) {
      const { label, labelConfidence, ...rest } = row;
      return rest;
    }
    return row;
  });
}

export function findSimilarTransactions(
  data: TransactionData[],
  targetRow: TransactionData,
  similarityThreshold: number = 0.8
): TransactionData[] {
  const target = targetRow;

  return data.filter(row => {
    if (row.id === target.id) return false;

    let similarity = 0;
    let comparisons = 0;

    // Compare description/merchant
    const descriptionFields = ['Description', 'description', 'Merchant', 'merchant'];
    for (const field of descriptionFields) {
      if (target[field] && row[field]) {
        const targetDesc = String(target[field]).toLowerCase();
        const rowDesc = String(row[field]).toLowerCase();

        if (targetDesc === rowDesc) {
          similarity += 1;
        } else if (targetDesc.includes(rowDesc) || rowDesc.includes(targetDesc)) {
          similarity += 0.7;
        } else {
          // Check for partial matches
          const targetWords = targetDesc.split(' ');
          const rowWords = rowDesc.split(' ');
          const commonWords = targetWords.filter(word =>
            word.length > 3 && rowWords.includes(word)
          );
          if (commonWords.length > 0) {
            similarity += 0.5 * (commonWords.length / Math.max(targetWords.length, rowWords.length));
          }
        }
        comparisons++;
        break; // Only compare first found description field
      }
    }

    // Compare amount (for recurring transactions)
    const amountFields = ['Amount', 'amount', 'Value', 'value'];
    for (const field of amountFields) {
      if (target[field] && row[field]) {
        const targetAmount = Math.abs(Number(target[field]));
        const rowAmount = Math.abs(Number(row[field]));

        if (targetAmount === rowAmount) {
          similarity += 0.3;
        } else if (Math.abs(targetAmount - rowAmount) / Math.max(targetAmount, rowAmount) < 0.1) {
          similarity += 0.2; // Similar amounts (within 10%)
        }
        comparisons++;
        break;
      }
    }

    return comparisons > 0 && (similarity / comparisons) >= similarityThreshold;
  });
}

export function getLabelById(labels: Label[], labelId: string): Label | undefined {
  return labels.find(label => label.id === labelId);
}

export function updateLabelUsage(labels: Label[], labelId: string, increment: number = 1): Label[] {
  return labels.map(label =>
    label.id === labelId
      ? { ...label, usageCount: label.usageCount + increment }
      : label
  );
}

export function getLabelingStats(data: TransactionData[], labels: Label[]) {
  const stats = {
    totalRows: data.length,
    labeledRows: 0,
    unlabeledRows: 0,
    labelCounts: {} as Record<string, number>,
    completionPercentage: 0,
  };

  data.forEach(row => {
    if (row.label) {
      stats.labeledRows++;
      stats.labelCounts[row.label] = (stats.labelCounts[row.label] || 0) + 1;
    } else {
      stats.unlabeledRows++;
    }
  });

  stats.completionPercentage = stats.totalRows > 0
    ? Math.round((stats.labeledRows / stats.totalRows) * 100)
    : 0;

  return stats;
}

// Label Group management utilities
export function createLabelGroup(
  name: string,
  color: string,
  description?: string,
  labels: string[] = []
): Omit<LabelGroup, 'id'> {
  return {
    name,
    color,
    description,
    labels,
  };
}

export function updateLabelGroupUsage(groups: LabelGroup[], groupId: string, labelIds: string[]): LabelGroup[] {
  return groups.map(group =>
    group.id === groupId
      ? { ...group, labels: labelIds }
      : group
  );
}

export function getGroupById(groups: LabelGroup[], groupId: string): LabelGroup | undefined {
  return groups.find(group => group.id === groupId);
}

export function getLabelsInGroup(labels: Label[], groupId: string | undefined): Label[] {
  if (!groupId) return labels.filter(label => !label.group);
  return labels.filter(label => label.group === groupId);
}

export function getUngroupedLabels(labels: Label[]): Label[] {
  return labels.filter(label => !label.group);
}
