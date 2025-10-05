export interface TransactionData {
  [key: string]: string | number | null | undefined;
  id?: string; // Unique identifier for each row
  label?: string; // Assigned label/category
  labelConfidence?: number; // Confidence score for the label (0-1)
}

export interface ValidationReport {
  totalRows: number;
  totalColumns: number;
  missingValues: Record<string, number>;
  duplicateRows: number;
  dataTypes: Record<string, string>;
  numericColumns: string[];
  dateColumns: string[];
  issues: string[];
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string;
  group?: string;
  createdAt: Date;
  usageCount: number;
}

export interface LabelGroup {
  id: string;
  name: string;
  color: string;
  description?: string;
  labels: string[]; // Array of label IDs
}

export interface LabelingAction {
  id: string;
  type: 'label' | 'unlabel' | 'bulk_label' | 'create_label' | 'delete_label';
  timestamp: Date;
  rowIds: string[];
  labelId?: string;
  previousLabelId?: string;
  data?: any; // Additional action data
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  pattern: string; // Text-based pattern for now
  labelId?: string; // Optional label to apply
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  transactionIds: string[]; // Transactions assigned to this rule
}

export interface DataState {
  data: TransactionData[] | null;
  fileName: string | null;
  validationReport: ValidationReport | null;
  isLoading: boolean;
  labels: Label[];
  labelGroups: LabelGroup[];
  selectedRows: Set<string>;
  actionHistory: LabelingAction[];
  currentHistoryIndex: number;
  isLabelingMode: boolean;
  recommendations: any[]; // Will be typed as Recommendation[] when imported
  isGeneratingRecommendations: boolean;
  dismissedRecommendations: Set<string>;
  rulePreview: any | null; // Will be typed as RulePreview when imported
  isRuleModalOpen: boolean;
  rules: Rule[]; // New rules state
  isRuleManagerOpen: boolean; // New rule manager modal state
  currentTransaction?: TransactionData; // Current transaction for rule management
}
