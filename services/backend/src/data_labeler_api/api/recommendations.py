"""
Recommendations API for smart labeling suggestions
"""

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime
from collections import Counter, defaultdict
from pydantic import BaseModel

from ..models.transaction import Transaction
from ..services.rule_engine import rule_engine
from ..core.storage import storage_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


class Recommendation(BaseModel):
    """Recommendation model"""
    transaction_id: str
    suggested_label_id: str
    confidence: float
    reason: str
    rule_id: Optional[str] = None
    pattern_matches: List[str] = []
    similar_transactions: List[str] = []


@router.get("/smart-suggestions", response_model=List[Recommendation])
async def get_smart_suggestions(
    file_id: str = Query(..., description="File ID to analyze"),
    limit: int = Query(50, description="Maximum number of suggestions to return"),
    min_confidence: float = Query(0.3, description="Minimum confidence threshold")
):
    """
    Get smart labeling suggestions based on transaction patterns

    - **file_id**: File ID containing transactions
    - **limit**: Maximum number of suggestions to return
    - **min_confidence**: Minimum confidence threshold for suggestions
    """
    try:
        # Get transactions from file
        processed_data = storage_manager.get_processed_data(file_id)
        if not processed_data:
            raise HTTPException(status_code=404, detail="File not processed yet")

        transactions = processed_data.get("transactions", [])
        labeled_transactions = [t for t in transactions if t.get('label')]

        if len(labeled_transactions) < 2:
            return []  # Need at least 2 labeled transactions for pattern analysis

        # Analyze patterns and generate recommendations
        recommendations = analyze_transaction_patterns(transactions, labeled_transactions, min_confidence)

        # Sort by confidence and limit results
        recommendations.sort(key=lambda r: r.confidence, reverse=True)
        limited_recommendations = recommendations[:limit]

        logger.info(f"Generated {len(recommendations)} smart suggestions, returning {len(limited_recommendations)}")
        return limited_recommendations

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating smart suggestions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")


@router.get("/pattern-analysis", response_model=Dict[str, Any])
async def analyze_patterns(
    file_id: str = Query(..., description="File ID to analyze"),
    include_statistics: bool = Query(True, description="Include statistical analysis")
):
    """
    Analyze transaction patterns for insights

    - **file_id**: File ID containing transactions
    - **include_statistics**: Whether to include statistical analysis
    """
    try:
        # Get transactions from file
        processed_data = storage_manager.get_processed_data(file_id)
        if not processed_data:
            raise HTTPException(status_code=404, detail="File not processed yet")

        transactions = processed_data.get("transactions", [])

        # Analyze patterns
        analysis = {
            "total_transactions": len(transactions),
            "labeled_transactions": len([t for t in transactions if t.get('label')]),
            "merchant_patterns": analyze_merchant_patterns(transactions),
            "amount_patterns": analyze_amount_patterns(transactions),
            "description_patterns": analyze_description_patterns(transactions)
        }

        if include_statistics:
            analysis["statistics"] = calculate_transaction_statistics(transactions)

        logger.info(f"Analyzed patterns for {len(transactions)} transactions")
        return analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing patterns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze patterns: {str(e)}")


def analyze_transaction_patterns(transactions: List[Dict], labeled_transactions: List[Dict], min_confidence: float) -> List[Recommendation]:
    """Analyze transaction patterns to generate recommendations"""
    recommendations = []

    # Group transactions by merchant
    merchant_groups = defaultdict(list)
    for transaction in transactions:
        merchant = rule_engine.extract_merchant(str(transaction.get('Description', transaction.get('description', ''))))
        merchant_groups[merchant].append(transaction)

    # Analyze each merchant group
    for merchant, merchant_transactions in merchant_groups.items():
        if merchant == 'UNKNOWN' or len(merchant_transactions) < 2:
            continue

        # Find labeled transactions for this merchant
        labeled_for_merchant = [t for t in labeled_transactions if
                               rule_engine.extract_merchant(str(t.get('Description', t.get('description', '')))) == merchant]

        if len(labeled_for_merchant) < 1:
            continue

        # Get the most common label for this merchant
        labels = [t.get('label') for t in labeled_for_merchant if t.get('label')]
        if not labels:
            continue

        most_common_label = Counter(labels).most_common(1)[0][0]

        # Generate recommendations for unlabeled transactions of this merchant
        unlabeled_for_merchant = [t for t in merchant_transactions if not t.get('label')]

        for transaction in unlabeled_for_merchant:
            # Calculate confidence based on:
            # 1. How many similar labeled transactions exist
            # 2. How consistent the labeling is
            # 3. How specific the merchant pattern is

            label_consistency = Counter(labels).most_common(1)[0][1] / len(labels)
            merchant_specificity = min(1.0, len(merchant_transactions) / 10)  # More transactions = more confidence
            confidence = (label_consistency * 0.6) + (merchant_specificity * 0.4)

            if confidence >= min_confidence:
                recommendations.append(Recommendation(
                    transaction_id=str(transaction.get('id', '')),
                    suggested_label_id=most_common_label,
                    confidence=confidence,
                    reason=f"Pattern analysis: {len(labeled_for_merchant)} similar transactions labeled '{most_common_label}'",
                    pattern_matches=[merchant],
                    similar_transactions=[str(t.get('id', '')) for t in labeled_for_merchant[:3]]
                ))

    return recommendations


def analyze_merchant_patterns(transactions: List[Dict]) -> Dict[str, Any]:
    """Analyze merchant patterns in transactions"""
    merchants = []
    for transaction in transactions:
        merchant = rule_engine.extract_merchant(str(transaction.get('Description', transaction.get('description', ''))))
        if merchant != 'UNKNOWN':
            merchants.append(merchant)

    if not merchants:
        return {"top_merchants": [], "total_unique_merchants": 0}

    merchant_counts = Counter(merchants)
    top_merchants = merchant_counts.most_common(10)

    return {
        "top_merchants": [{"merchant": merchant, "count": count} for merchant, count in top_merchants],
        "total_unique_merchants": len(merchant_counts),
        "most_common_merchant": top_merchants[0][0] if top_merchants else None
    }


def analyze_amount_patterns(transactions: List[Dict]) -> Dict[str, Any]:
    """Analyze amount patterns in transactions"""
    amounts = []
    for transaction in transactions:
        amount = transaction.get('Amount', transaction.get('amount', 0))
        try:
            amounts.append(float(amount))
        except (ValueError, TypeError):
            continue

    if not amounts:
        return {"patterns": [], "statistics": {}}

    # Find common amount patterns (round to 2 decimal places)
    rounded_amounts = [round(a, 2) for a in amounts]
    amount_counts = Counter(rounded_amounts)

    # Find recurring amounts
    recurring_amounts = [amount for amount, count in amount_counts.items() if count > 1]

    # Group by amount ranges
    ranges = {
        "under_10": len([a for a in amounts if 0 < a < 10]),
        "10_to_50": len([a for a in amounts if 10 <= a < 50]),
        "50_to_100": len([a for a in amounts if 50 <= a < 100]),
        "100_to_500": len([a for a in amounts if 100 <= a < 500]),
        "500_to_1000": len([a for a in amounts if 500 <= a < 1000]),
        "over_1000": len([a for a in amounts if a >= 1000])
    }

    return {
        "recurring_amounts": sorted(recurring_amounts, reverse=True)[:10],
        "amount_ranges": ranges,
        "statistics": {
            "min_amount": min(amounts),
            "max_amount": max(amounts),
            "avg_amount": sum(amounts) / len(amounts),
            "median_amount": sorted(amounts)[len(amounts) // 2]
        }
    }


def analyze_description_patterns(transactions: List[Dict]) -> Dict[str, Any]:
    """Analyze description patterns in transactions"""
    descriptions = []
    for transaction in transactions:
        desc = str(transaction.get('Description', transaction.get('description', '')))
        if desc:
            descriptions.append(desc)

    if not descriptions:
        return {"patterns": [], "common_words": []}

    # Find common words in descriptions (excluding common stop words)
    stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'an', 'a'}
    word_counts = Counter()

    for desc in descriptions:
        words = desc.lower().split()
        for word in words:
            # Remove punctuation
            word = ''.join(c for c in word if c.isalnum())
            if len(word) > 2 and word not in stop_words:
                word_counts[word] += 1

    common_words = word_counts.most_common(20)

    return {
        "common_words": [{"word": word, "count": count} for word, count in common_words],
        "total_descriptions": len(descriptions),
        "avg_description_length": sum(len(desc) for desc in descriptions) / len(descriptions)
    }


def calculate_transaction_statistics(transactions: List[Dict]) -> Dict[str, Any]:
    """Calculate statistical insights about transactions"""
    amounts = []
    dates = []

    for transaction in transactions:
        # Extract amounts
        amount = transaction.get('Amount', transaction.get('amount', 0))
        try:
            amounts.append(float(amount))
        except (ValueError, TypeError):
            continue

        # Extract dates
        date_str = transaction.get('Date', transaction.get('date', ''))
        if date_str:
            try:
                dates.append(datetime.fromisoformat(date_str.replace('Z', '+00:00')))
            except (ValueError, TypeError):
                continue

    if not amounts:
        return {"error": "No valid amounts found"}

    stats = {
        "amounts": {
            "count": len(amounts),
            "min": min(amounts),
            "max": max(amounts),
            "average": sum(amounts) / len(amounts),
            "median": sorted(amounts)[len(amounts) // 2],
            "total_volume": sum(amounts)
        }
    }

    if dates:
        stats["dates"] = {
            "count": len(dates),
            "earliest": min(dates).isoformat(),
            "latest": max(dates).isoformat(),
            "date_range_days": (max(dates) - min(dates)).days
        }

    return stats
