import { Rule, TransactionData } from '@/types';

// Generate a unique ID for rules
export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new rule
export function createRule(
  name: string,
  description?: string,
  conditions?: Rule['conditions'],
  regex?: Rule['regex'],
  labelId?: string,
  priority: number = 0,
  confidence: number = 0.5,
  transactionIds: string[] = []
): Rule {
  const now = new Date();
  return {
    id: generateRuleId(),
    name,
    description,
    conditions: conditions || {},
    regex: regex || {},
    labelId,
    priority,
    isActive: true,
    confidence,
    createdAt: now,
    updatedAt: now,
    transactionIds,
  };
}

// Check if a transaction matches a rule pattern
export function doesTransactionMatchRule(transaction: TransactionData, rule: Rule): boolean {
  if (!rule.isActive) return false;

  const description = String(transaction.Description || transaction.description || '').toLowerCase();
  const merchant = String(transaction.Merchant || '').toLowerCase();
  const amount = Number(transaction.Amount || transaction.amount || 0);

  // Check merchant condition
  if (rule.conditions?.merchant) {
    if (!merchant.includes(rule.conditions.merchant.toLowerCase())) {
      return false;
    }
  }

  // Check description condition
  if (rule.conditions?.description) {
    if (!description.includes(rule.conditions.description.toLowerCase())) {
      return false;
    }
  }

  // Check amount condition
  if (rule.conditions?.amount) {
    const { min, max, exact } = rule.conditions.amount;
    if (exact !== undefined && Math.abs(amount - exact) > 0.01) {
      return false;
    }
    if (min !== undefined && amount < min) {
      return false;
    }
    if (max !== undefined && amount > max) {
      return false;
    }
  }

  // Check regex patterns
  if (rule.regex?.merchant) {
    try {
      const regex = new RegExp(rule.regex.merchant, 'i');
      if (!regex.test(merchant)) {
        return false;
      }
    } catch (e) {
      // Invalid regex, skip this check
    }
  }

  if (rule.regex?.description) {
    try {
      const regex = new RegExp(rule.regex.description, 'i');
      if (!regex.test(description)) {
        return false;
      }
    } catch (e) {
      // Invalid regex, skip this check
    }
  }

  return true;
}

// Find transactions that match a rule
export function findTransactionsForRule(transactions: TransactionData[], rule: Rule): TransactionData[] {
  return transactions.filter(transaction => doesTransactionMatchRule(transaction, rule));
}

// Apply a rule to transactions (find matches and add them to the rule)
export function applyRuleToTransactions(rule: Rule, transactions: TransactionData[]): Rule {
  const matchingTransactions = findTransactionsForRule(transactions, rule);
  const newTransactionIds = matchingTransactions
    .filter(t => !rule.transactionIds.includes(t.id!))
    .map(t => t.id!);

  return {
    ...rule,
    transactionIds: [...rule.transactionIds, ...newTransactionIds],
    updatedAt: new Date(),
  };
}

// Remove a transaction from a rule
export function removeTransactionFromRule(rule: Rule, transactionId: string): Rule {
  return {
    ...rule,
    transactionIds: rule.transactionIds.filter(id => id !== transactionId),
    updatedAt: new Date(),
  };
}

// Add a transaction to a rule
export function addTransactionToRule(rule: Rule, transactionId: string): Rule {
  if (rule.transactionIds.includes(transactionId)) {
    return rule; // Already exists
  }

  return {
    ...rule,
    transactionIds: [...rule.transactionIds, transactionId],
    updatedAt: new Date(),
  };
}

// Update rule properties
export function updateRule(rule: Rule, updates: Partial<Omit<Rule, 'id' | 'createdAt'>>): Rule {
  return {
    ...rule,
    ...updates,
    updatedAt: new Date(),
  };
}

// Get transactions that belong to a specific rule
export function getTransactionsForRule(transactions: TransactionData[], rule: Rule): TransactionData[] {
  return transactions.filter(t => rule.transactionIds.includes(t.id!));
}

// Get all rules that contain a specific transaction
export function getRulesForTransaction(rules: Rule[], transactionId: string): Rule[] {
  return rules.filter(rule => rule.transactionIds.includes(transactionId));
}

// Reapply a specific rule to all transactions (useful after editing rule properties)
export function reapplyRule(rule: Rule, transactions: TransactionData[]): Rule {
  // Find current matches
  const currentMatches = findTransactionsForRule(transactions, rule);

  // Update transaction IDs - remove old matches that no longer apply, add new matches
  const currentTransactionIds = rule.transactionIds;
  const newTransactionIds = currentMatches.map(t => t.id!);

  // Remove transactions that no longer match
  const toRemove = currentTransactionIds.filter(id => !newTransactionIds.includes(id));
  // Add new transactions that now match
  const toAdd = newTransactionIds.filter(id => !currentTransactionIds.includes(id));

  let updatedTransactionIds = [...currentTransactionIds];
  toRemove.forEach(id => {
    updatedTransactionIds = updatedTransactionIds.filter(existingId => existingId !== id);
  });
  updatedTransactionIds = [...updatedTransactionIds, ...toAdd];

  return {
    ...rule,
    transactionIds: updatedTransactionIds,
    updatedAt: new Date(),
  };
}

// Reapply all rules that reference a specific label (useful after editing label)
export function reapplyRulesForLabel(rules: Rule[], labelId: string, transactions: TransactionData[]): Rule[] {
  return rules.map(rule => {
    if (rule.labelId === labelId && rule.isActive) {
      return reapplyRule(rule, transactions);
    }
    return rule;
  });
}

// Reapply all active rules to all transactions (useful for bulk updates)
export function reapplyAllRules(rules: Rule[], transactions: TransactionData[]): Rule[] {
  return rules.map(rule => {
    if (rule.isActive) {
      return reapplyRule(rule, transactions);
    }
    return rule;
  });
}

// Suggest pattern based on transaction description
export function suggestPatternFromTransaction(transaction: TransactionData): string {
  const description = String(transaction.Description || transaction.description || '');

  // Extract merchant-like words (uppercase, 3+ chars, not common transaction terms)
  const excludeWords = new Set([
    'DEBIT', 'CREDIT', 'PURCHASE', 'PAYMENT', 'WITHDRAWAL', 'TRANSFER', 'POS', 'ATM',
    'CARD', 'VISA', 'MASTERCARD', 'AMEX', 'FEE', 'CHARGE', 'TRANSACTION', 'DEPOSIT',
    'AUTOPAY', 'BILL', 'COMPANY', 'INC', 'LLC', 'CORP', 'CO', 'LTD', 'STORE'
  ]);

  const words = description
    .match(/\b[A-Z]{3,}\b/g) // Get uppercase words 3+ chars
    ?.filter(word => {
      const upper = word.toUpperCase();
      return !excludeWords.has(upper) &&
             !upper.match(/^\d+$/) && // Not just numbers
             !upper.match(/^[A-Z]{2}\d+$/) && // Not state codes + numbers
             upper.length >= 3;
    });

  if (words && words.length > 0) {
    return words[0].toLowerCase(); // Return first significant word
  }

  // Fallback: return first few characters of description
  const cleaned = description.replace(/[^a-zA-Z\s]/g, '').trim();
  const firstWords = cleaned.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
  return firstWords || 'transaction';
}
