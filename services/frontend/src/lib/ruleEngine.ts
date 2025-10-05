import { TransactionData, Label, Rule } from '@/types';

// Helper function to convert old LabelingRule format to new Rule format
export function convertLabelingRuleToRule(labelingRule: any): Rule {
  return {
    id: labelingRule.id,
    name: labelingRule.name,
    labelId: labelingRule.labelId,
    conditions: labelingRule.patterns || {},
    regex: labelingRule.regex || {},
    priority: 0,
    isActive: labelingRule.isActive !== false,
    confidence: labelingRule.confidence || 0.5,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdFrom: labelingRule.createdFrom,
    matchCount: labelingRule.matchCount || 0,
    transactionIds: []
  };
}

// Extract merchant name from description
export function extractMerchant(description: string): string {
  if (!description) return '';

  const lowerDesc = description.toLowerCase();

  // Handle specific merchant patterns first (before cleaning)
  if (lowerDesc.includes('amazon')) {
    return 'AMAZON';
  }
  if (lowerDesc.includes('starbucks')) {
    return 'STARBUCKS';
  }
  if (lowerDesc.includes('mcdonalds') || lowerDesc.includes("mcdonald's")) {
    return 'MCDONALDS';
  }
  if (lowerDesc.includes('walmart')) {
    return 'WALMART';
  }
  if (lowerDesc.includes('target')) {
    return 'TARGET';
  }
  if (lowerDesc.includes('google') || lowerDesc.includes('youtube')) {
    return 'GOOGLE';
  }
  if (lowerDesc.includes('apple') && (lowerDesc.includes('store') || lowerDesc.includes('itunes'))) {
    return 'APPLE';
  }
  if (lowerDesc.includes('netflix')) {
    return 'NETFLIX';
  }
  if (lowerDesc.includes('spotify')) {
    return 'SPOTIFY';
  }
  if (lowerDesc.includes('uber')) {
    return 'UBER';
  }
  if (lowerDesc.includes('lyft')) {
    return 'LYFT';
  }

  // Handle domain-based merchants (like AMAZON.COM)
  const domainMatch = description.match(/([A-Z0-9]+\.COM)/i);
  if (domainMatch) {
    const domain = domainMatch[1].replace('.COM', '').toUpperCase();
    return domain;
  }

  // Remove common payment prefixes and clean
  let cleaned = description
    .replace(/^(DEBIT|CREDIT|PURCHASE|PAYMENT|WITHDRAWAL|TRANSFER|POS|ATM)\s*/i, '')
    .replace(/^(CARD|VISA|MASTERCARD|AMEX)\s*/i, '')
    .replace(/\s+(PURCHASE|PAYMENT|DEBIT|CREDIT)(\s|$)/i, '') // Remove these words anywhere
    .trim();

  // Remove card numbers and trailing info
  cleaned = cleaned.replace(/\s*\*+\d+.*$/, '');
  cleaned = cleaned.replace(/\s+\d{2}\/\d{2}.*$/, '');
  cleaned = cleaned.replace(/\s*X+\d+.*$/, '');

  // Remove location codes and transaction IDs
  cleaned = cleaned.replace(/\s+[A-Z]{2}\s*\d+.*$/, '');
  cleaned = cleaned.replace(/\s+#\d+.*$/, '');
  cleaned = cleaned.replace(/\s+REF\s*#.*$/, '');

  // Remove common suffixes
  cleaned = cleaned.replace(/\s+(INC|LLC|CORP|CO|LTD|GROUP|STORES?|RESTAURANT|CAFE|COFFEE|MARKET|SHOP|STORE)(\s|$)/i, '');

  // Remove .COM from the end if present
  cleaned = cleaned.replace(/\.COM\s*$/i, '');

  // Take the main merchant name (first 2-3 significant words)
  const words = cleaned.trim().split(/\s+/).filter(word => word.length > 1);
  const result = words.slice(0, Math.min(2, words.length)).join(' ').toUpperCase();

  return result || 'UNKNOWN';
}

// Generate regex pattern from text with smart escaping
export function generateRegexPattern(text: string, fuzzy: boolean = true): string {
  if (!text) return '';

  // Escape special regex characters
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (fuzzy) {
    // For fuzzy matching, use word boundaries to prevent partial matches
    // This ensures "AMAZON" doesn't match "PAYROLL" etc.
    const flexible = escaped
      .replace(/\s+/g, '[\\s\\-_]+') // Require spaces, hyphens, underscores between words
      .replace(/\./g, '\\.?'); // Make dots optional

    // Use word boundaries to ensure we match whole words only
    return `\\b${flexible}\\b`;
  } else {
    // For exact matching, use strict word boundaries
    const semiFlexible = escaped
      .replace(/\s+/g, '[\\s\\-_]*'); // Allow different spacing/separators

    return `\\b${semiFlexible}\\b`;
  }
}

// Analyze transaction to create intelligent regex patterns
export function analyzeTransactionPatterns(transaction: TransactionData): {
  descriptionPatterns: string[];
  merchantPatterns: string[];
  amountPattern?: { min: number; max: number; exact?: number };
} {
  const description = String(transaction.Description || transaction.description || '');
  const amount = Number(transaction.Amount || transaction.amount || 0);

  const merchant = extractMerchant(description);

  const patterns = {
    descriptionPatterns: [] as string[],
    merchantPatterns: [] as string[],
    amountPattern: undefined as { min: number; max: number; exact?: number } | undefined,
  };

  // SIMPLIFIED: Only create ONE precise merchant pattern to avoid false positives
  if (merchant && merchant !== 'UNKNOWN') {
    // Create a single, very precise pattern for the extracted merchant
    const pattern = generateRegexPattern(merchant, false);
    patterns.merchantPatterns.push(pattern);

    console.log(`[DEBUG] Created merchant pattern for "${merchant}": "${pattern}"`);
  } else {
    console.log(`[DEBUG] No valid merchant extracted from: "${description}"`);
  }

  // Amount patterns
  if (amount && amount !== 0) {
    const roundedAmount = Math.round(amount * 100) / 100;
    patterns.amountPattern = {
      exact: roundedAmount,
      min: roundedAmount * 0.95, // 5% tolerance
      max: roundedAmount * 1.05,
    };
  }

  return patterns;
}

// Find transactions matching the patterns
export function findMatchingTransactions(
  transactions: TransactionData[],
  patterns: ReturnType<typeof analyzeTransactionPatterns>,
  excludeIds: string[] = []
): TransactionData[] {
  console.log(`[DEBUG] Finding matches with patterns:`, patterns);

  const matches = transactions.filter(transaction => {
    if (excludeIds.includes(transaction.id!)) return false;

    const description = String(transaction.Description || transaction.description || '');

    // ONLY use merchant patterns for matching - this is most reliable
    if (patterns.merchantPatterns.length > 0) {
      const merchantMatch = patterns.merchantPatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          const result = regex.test(description);

          // Debug: Log EVERY test
          console.log(`[DEBUG] Testing pattern "${pattern}" against "${description}": ${result}`);

          return result;
        } catch (e) {
          console.error('[ERROR] Regex error:', e, 'Pattern:', pattern);
          return false;
        }
      });

      if (merchantMatch) {
        console.log(`[DEBUG] ✅ MATCH: "${description}"`);
      }

      return merchantMatch;
    }

    console.log(`[DEBUG] No merchant patterns to test against`);
    return false;
  });

  console.log(`[DEBUG] Found ${matches.length} matching transactions`);
  return matches;
}

// Frontend rule engine - simplified for UI-only operations
// Heavy computation moved to backend APIs

export interface RulePreview {
  rule: Rule;
  matchingTransactions: TransactionData[];
  suggestedRegex: {
    merchant?: string;
    description?: string;
  };
  patterns: {
    merchant?: string;
    description?: string;
    amount?: {
      min?: number;
      max?: number;
      exact?: number;
    };
  };
}

export function createRulePreview(
  transaction: TransactionData,
  label: Label,
  allTransactions: TransactionData[]
): RulePreview {
  const patterns = analyzeTransactionPatterns(transaction);

  const matchingTransactions = findMatchingTransactions(
    allTransactions,
    patterns,
    [transaction.id!]
  );

  const suggestedRegex = {
    merchant: patterns.merchantPatterns[0] || undefined,
    description: generateRegexPattern(String(transaction.Description || transaction.description || ''), false)
  };

  const rule: Rule = {
    id: generateId(),
    name: `${label.name} - ${extractMerchant(String(transaction.Description || transaction.description || ''))}`,
    description: `Auto-generated rule for ${label.name} based on transaction: ${String(transaction.Description || transaction.description || '')}`,
    pattern: patterns.merchantPatterns[0] || String(transaction.Description || transaction.description || '').toLowerCase(),
    conditions: {
      merchant: patterns.merchantPatterns[0] || undefined,
      description: String(transaction.Description || transaction.description || ''),
      amount: patterns.amountPattern ? {
        exact: patterns.amountPattern.exact,
        min: patterns.amountPattern.min,
        max: patterns.amountPattern.max
      } : undefined
    },
    regex: {
      merchant: patterns.merchantPatterns[0] || undefined,
      description: generateRegexPattern(String(transaction.Description || transaction.description || ''), false)
    },
    labelId: label.id,
    priority: 0,
    isActive: true,
    confidence: 0.8,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdFrom: transaction.id,
    matchCount: matchingTransactions.length,
    transactionIds: matchingTransactions.map(t => t.id!).filter(Boolean)
  };

  return {
    rule,
    matchingTransactions,
    suggestedRegex,
    patterns: {
      merchant: patterns.merchantPatterns[0] || undefined,
      description: String(transaction.Description || transaction.description || ''),
      amount: patterns.amountPattern ? {
        exact: patterns.amountPattern.exact,
        min: patterns.amountPattern.min,
        max: patterns.amountPattern.max
      } : undefined
    }
  };
}

export function applyRule(
  rule: Rule,
  transactions: TransactionData[],
  selectedTransactionIds: string[]
): TransactionData[] {
  return transactions.map(transaction => {
    if (selectedTransactionIds.includes(transaction.id!)) {
      return {
        ...transaction,
        label: rule.labelId,
        labelConfidence: rule.confidence
      };
    }
    return transaction;
  });
}

// Helper function to generate unique IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
