import { TransactionData, Label } from '@/types';
import { findSimilarTransactions } from './labelingUtils';

export interface Recommendation {
  id: string;
  rowId: string;
  labelId: string;
  confidence: number;
  reason: string;
  matchedTransactions: TransactionData[];
  algorithm: 'exact_match' | 'fuzzy_match' | 'amount_pattern' | 'merchant_pattern' | 'ml_similarity';
}

export interface RecommendationConfig {
  exactMatchWeight: number;
  fuzzyMatchWeight: number;
  amountPatternWeight: number;
  merchantPatternWeight: number;
  minimumConfidence: number;
  maxRecommendationsPerRow: number;
}

const DEFAULT_CONFIG: RecommendationConfig = {
  exactMatchWeight: 1.0,
  fuzzyMatchWeight: 0.8,
  amountPatternWeight: 0.6,
  merchantPatternWeight: 0.7,
  minimumConfidence: 0.6,
  maxRecommendationsPerRow: 3,
};

// Common merchant patterns for automatic categorization
const MERCHANT_PATTERNS = {
  'Food & Dining': [
    /starbucks/i, /mcdonalds/i, /burger king/i, /subway/i, /dominos/i, /pizza/i,
    /restaurant/i, /cafe/i, /coffee/i, /dining/i, /food/i, /grocery/i, /market/i,
    /safeway/i, /whole foods/i, /kroger/i, /walmart/i, /target.*food/i
  ],
  'Transportation': [
    /gas station/i, /shell/i, /exxon/i, /chevron/i, /bp/i, /uber/i, /lyft/i,
    /taxi/i, /transit/i, /metro/i, /parking/i, /toll/i, /dmv/i, /auto/i
  ],
  'Bills & Utilities': [
    /electric/i, /power/i, /gas.*utility/i, /water/i, /internet/i, /comcast/i,
    /verizon/i, /at&t/i, /phone/i, /cable/i, /utility/i, /trash/i, /sewer/i
  ],
  'Shopping': [
    /amazon/i, /ebay/i, /walmart/i, /target/i, /costco/i, /bestbuy/i, /apple/i,
    /store/i, /shop/i, /retail/i, /purchase/i, /sale/i
  ],
  'Entertainment': [
    /netflix/i, /spotify/i, /hulu/i, /disney/i, /movie/i, /theater/i, /cinema/i,
    /game/i, /entertainment/i, /subscription/i, /streaming/i
  ],
  'Healthcare': [
    /pharmacy/i, /cvs/i, /walgreens/i, /hospital/i, /medical/i, /doctor/i,
    /dental/i, /clinic/i, /health/i, /insurance.*medical/i
  ],
  'Transfer': [
    /transfer/i, /payment/i, /venmo/i, /paypal/i, /zelle/i, /cashapp/i,
    /deposit/i, /withdrawal/i, /atm/i
  ],
  'Fees': [
    /fee/i, /charge/i, /penalty/i, /overdraft/i, /maintenance/i, /service.*fee/i,
    /late.*fee/i, /bank.*fee/i
  ]
};

// Amount pattern recognition
interface AmountPattern {
  ranges: number[][];
  recurring: boolean;
  positiveOnly?: boolean;
}

const AMOUNT_PATTERNS: Record<string, AmountPattern> = {
  'Bills & Utilities': {
    ranges: [[50, 300], [100, 500]], // Common utility bill ranges
    recurring: true
  },
  'Income': {
    ranges: [[1000, 10000]], // Salary ranges
    recurring: true,
    positiveOnly: true
  },
  'Fees': {
    ranges: [[1, 50]], // Small fees
    recurring: false
  }
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMerchantName(description: string): string {
  // Extract merchant name from transaction description
  const normalized = normalizeText(description);

  // Common patterns to clean up merchant names
  const patterns = [
    /^(purchase\s+)?(.+?)\s+\d{2}\/\d{2}.*$/i, // "PURCHASE STARBUCKS 12/25"
    /^(.+?)\s+#\d+.*$/i, // "STARBUCKS #1234"
    /^(.+?)\s+\d{3,}.*$/i, // "STARBUCKS 123456"
    /^(.+?)\s+(debit|credit).*$/i, // "STARBUCKS DEBIT"
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return normalized.split(' ').slice(0, 3).join(' '); // First 3 words
}

export function calculateExactMatchConfidence(
  row: TransactionData,
  labeledData: TransactionData[],
  labelId: string
): { confidence: number; matches: TransactionData[] } {
  const rowMerchant = extractMerchantName(String(row.Description || row.description || ''));
  const rowAmount = Math.abs(Number(row.Amount || row.amount || 0));

  const exactMatches = labeledData.filter(labeled => {
    if (labeled.label !== labelId) return false;

    const labeledMerchant = extractMerchantName(String(labeled.Description || labeled.description || ''));
    const labeledAmount = Math.abs(Number(labeled.Amount || labeled.amount || 0));

    // Exact merchant match
    const merchantMatch = rowMerchant === labeledMerchant;

    // Amount within 5% or exact match
    const amountMatch = rowAmount === labeledAmount ||
      Math.abs(rowAmount - labeledAmount) / Math.max(rowAmount, labeledAmount) < 0.05;

    return merchantMatch && amountMatch;
  });

  const confidence = Math.min(exactMatches.length * 0.3, 1.0);
  return { confidence, matches: exactMatches };
}

export function calculateFuzzyMatchConfidence(
  row: TransactionData,
  labeledData: TransactionData[],
  labelId: string
): { confidence: number; matches: TransactionData[] } {
  const similarTransactions = findSimilarTransactions(labeledData, row, 0.7);
  const labelMatches = similarTransactions.filter(t => t.label === labelId);

  if (labelMatches.length === 0) {
    return { confidence: 0, matches: [] };
  }

  const totalSimilar = similarTransactions.length;
  const labelRatio = labelMatches.length / totalSimilar;
  const confidence = labelRatio * 0.8; // Max 80% confidence for fuzzy matches

  return { confidence, matches: labelMatches };
}

export function calculateMerchantPatternConfidence(
  row: TransactionData,
  labelName: string
): { confidence: number; reason: string } {
  const description = String(row.Description || row.description || '').toLowerCase();
  const patterns = MERCHANT_PATTERNS[labelName as keyof typeof MERCHANT_PATTERNS];

  if (!patterns) {
    return { confidence: 0, reason: '' };
  }

  for (const pattern of patterns) {
    if (pattern.test(description)) {
      return {
        confidence: 0.9, // High confidence for pattern matches
        reason: `Merchant pattern match: "${pattern.source}"`
      };
    }
  }

  return { confidence: 0, reason: '' };
}

export function calculateAmountPatternConfidence(
  row: TransactionData,
  labelName: string,
  labeledData: TransactionData[]
): { confidence: number; reason: string } {
  const amount = Number(row.Amount || row.amount || 0);
  const patternConfig = AMOUNT_PATTERNS[labelName];

  if (!patternConfig) {
    return { confidence: 0, reason: '' };
  }

  // Check if amount is positive only for income
  if (patternConfig.positiveOnly && amount <= 0) {
    return { confidence: 0, reason: '' };
  }

  const absAmount = Math.abs(amount);

  // Check if amount falls within expected ranges
  const inRange = patternConfig.ranges.some(([min, max]) =>
    absAmount >= min && absAmount <= max
  );

  if (!inRange) {
    return { confidence: 0, reason: '' };
  }

  // Check for recurring pattern if enabled
  if (patternConfig.recurring) {
    const similarAmounts = labeledData.filter(t => {
      const tAmount = Math.abs(Number(t.Amount || t.amount || 0));
      return Math.abs(tAmount - absAmount) / Math.max(tAmount, absAmount) < 0.1;
    });

    if (similarAmounts.length >= 2) {
      return {
        confidence: 0.7,
        reason: `Recurring amount pattern: $${absAmount.toFixed(2)}`
      };
    }
  }

  return {
    confidence: 0.5,
    reason: `Amount range match for ${labelName}`
  };
}

export function generateRecommendations(
  unlabeledRows: TransactionData[],
  labeledData: TransactionData[],
  labels: Label[],
  config: RecommendationConfig = DEFAULT_CONFIG
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const row of unlabeledRows) {
    if (!row.id) continue;

    const rowRecommendations: Recommendation[] = [];

    for (const label of labels) {
      // Calculate different types of confidence scores
      const exactMatch = calculateExactMatchConfidence(row, labeledData, label.id);
      const fuzzyMatch = calculateFuzzyMatchConfidence(row, labeledData, label.id);
      const merchantPattern = calculateMerchantPatternConfidence(row, label.name);
      const amountPattern = calculateAmountPatternConfidence(row, label.name, labeledData);

      // Combine scores with weights
      let totalConfidence = 0;
      let primaryReason = '';
      let algorithm: Recommendation['algorithm'] = 'fuzzy_match';
      let matchedTransactions: TransactionData[] = [];

      if (exactMatch.confidence > 0) {
        totalConfidence = Math.max(totalConfidence, exactMatch.confidence * config.exactMatchWeight);
        primaryReason = `Exact match with ${exactMatch.matches.length} similar transactions`;
        algorithm = 'exact_match';
        matchedTransactions = exactMatch.matches;
      }

      if (fuzzyMatch.confidence > 0) {
        const weightedScore = fuzzyMatch.confidence * config.fuzzyMatchWeight;
        if (weightedScore > totalConfidence) {
          totalConfidence = weightedScore;
          primaryReason = `Similar to ${fuzzyMatch.matches.length} labeled transactions`;
          algorithm = 'fuzzy_match';
          matchedTransactions = fuzzyMatch.matches;
        }
      }

      if (merchantPattern.confidence > 0) {
        const weightedScore = merchantPattern.confidence * config.merchantPatternWeight;
        if (weightedScore > totalConfidence) {
          totalConfidence = weightedScore;
          primaryReason = merchantPattern.reason;
          algorithm = 'merchant_pattern';
          matchedTransactions = [];
        }
      }

      if (amountPattern.confidence > 0) {
        const weightedScore = amountPattern.confidence * config.amountPatternWeight;
        if (weightedScore > totalConfidence) {
          totalConfidence = weightedScore;
          primaryReason = amountPattern.reason;
          algorithm = 'amount_pattern';
          matchedTransactions = [];
        }
      }

      // Only add recommendations above minimum confidence
      if (totalConfidence >= config.minimumConfidence) {
        rowRecommendations.push({
          id: generateId(),
          rowId: row.id,
          labelId: label.id,
          confidence: totalConfidence,
          reason: primaryReason,
          matchedTransactions,
          algorithm
        });
      }
    }

    // Sort by confidence and take top N recommendations
    rowRecommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.maxRecommendationsPerRow)
      .forEach(rec => recommendations.push(rec));
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

export function updateRecommendationConfig(
  updates: Partial<RecommendationConfig>
): RecommendationConfig {
  return { ...DEFAULT_CONFIG, ...updates };
}

export function getRecommendationStats(recommendations: Recommendation[]) {
  const stats = {
    total: recommendations.length,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    byAlgorithm: {} as Record<string, number>,
    averageConfidence: 0
  };

  let totalConfidence = 0;

  recommendations.forEach(rec => {
    totalConfidence += rec.confidence;

    if (rec.confidence >= 0.8) stats.highConfidence++;
    else if (rec.confidence >= 0.6) stats.mediumConfidence++;
    else stats.lowConfidence++;

    stats.byAlgorithm[rec.algorithm] = (stats.byAlgorithm[rec.algorithm] || 0) + 1;
  });

  stats.averageConfidence = recommendations.length > 0
    ? totalConfidence / recommendations.length
    : 0;

  return stats;
}
