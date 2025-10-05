"""
Merchant patterns management service
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import uuid

from ..models.merchant_patterns import (
    MerchantPattern, MerchantPatternCreate, MerchantPatternUpdate,
    MerchantPatternStats
)

logger = logging.getLogger(__name__)


class MerchantPatternManager:
    """Service for managing merchant patterns"""

    def __init__(self):
        # In-memory storage for MVP (could be replaced with database)
        self.patterns_db: Dict[str, MerchantPattern] = {}

        # Default patterns to bootstrap the system
        self._initialize_default_patterns()

    def _initialize_default_patterns(self):
        """Initialize with empty patterns - let users configure what they need"""
        # Start with no default patterns - the system should be completely domain-agnostic
        # Users can configure patterns through the API for their specific use case
        pass

    def create_pattern(self, pattern_data: MerchantPatternCreate) -> MerchantPattern:
        """Create a new merchant pattern"""
        pattern = MerchantPattern(
            id=f"pattern_{uuid.uuid4().hex[:8]}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            **pattern_data.dict()
        )

        # Validate pattern
        try:
            re.compile(pattern.pattern, re.IGNORECASE)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {e}")

        self.patterns_db[pattern.id] = pattern
        logger.info(f"Created merchant pattern: {pattern.name}")
        return pattern

    def get_pattern(self, pattern_id: str) -> Optional[MerchantPattern]:
        """Get a pattern by ID"""
        return self.patterns_db.get(pattern_id)

    def update_pattern(self, pattern_id: str, updates: MerchantPatternUpdate) -> MerchantPattern:
        """Update an existing pattern"""
        pattern = self.patterns_db.get(pattern_id)
        if not pattern:
            raise ValueError(f"Pattern {pattern_id} not found")

        # Apply updates
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(pattern, field):
                setattr(pattern, field, value)

        # Validate pattern if it was updated
        if 'pattern' in update_data:
            try:
                re.compile(pattern.pattern, re.IGNORECASE)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern: {e}")

        pattern.updated_at = datetime.utcnow()
        logger.info(f"Updated merchant pattern: {pattern.name}")
        return pattern

    def delete_pattern(self, pattern_id: str) -> bool:
        """Delete a pattern"""
        if pattern_id in self.patterns_db:
            pattern = self.patterns_db[pattern_id]
            del self.patterns_db[pattern_id]
            logger.info(f"Deleted merchant pattern: {pattern.name}")
            return True
        return False

    def list_patterns(self, active_only: bool = True) -> List[MerchantPattern]:
        """List all patterns"""
        patterns = list(self.patterns_db.values())

        if active_only:
            patterns = [p for p in patterns if p.is_active]

        # Sort by usage count and confidence
        patterns.sort(key=lambda p: (-p.usage_count, -p.confidence))
        return patterns

    def extract_merchant_from_description(self, description: str) -> str:
        """Extract merchant name from transaction description using patterns"""
        if not description:
            return 'UNKNOWN'

        description_lower = description.lower()
        best_match = None
        best_confidence = 0.0

        # Test each active pattern
        for pattern in self.list_patterns():
            try:
                if re.search(pattern.pattern, description_lower, re.IGNORECASE):
                    # Calculate match confidence
                    match_confidence = pattern.confidence

                    # Boost confidence for exact matches
                    if pattern.pattern.strip(r'\b') == description_lower.strip():
                        match_confidence = min(1.0, match_confidence + 0.1)

                    if match_confidence > best_confidence:
                        best_confidence = match_confidence
                        best_match = pattern

            except re.error:
                logger.warning(f"Invalid regex pattern for {pattern.name}: {pattern.pattern}")
                continue

        if best_match:
            # Update usage statistics
            best_match.usage_count += 1
            self.patterns_db[best_match.id] = best_match
            return best_match.name

        return 'UNKNOWN'

    def get_stats(self) -> MerchantPatternStats:
        """Get statistics about merchant patterns"""
        patterns = self.list_patterns(active_only=False)

        if not patterns:
            return MerchantPatternStats(
                total_patterns=0,
                active_patterns=0,
                total_usage=0,
                average_confidence=0.0
            )

        active_patterns = [p for p in patterns if p.is_active]
        total_usage = sum(p.usage_count for p in patterns)

        # Calculate average confidence
        avg_confidence = sum(p.confidence for p in active_patterns) / len(active_patterns) if active_patterns else 0.0

        # Get top performing patterns
        top_performing = []
        for pattern in sorted(patterns, key=lambda p: p.usage_count, reverse=True)[:10]:
            top_performing.append({
                "id": pattern.id,
                "name": pattern.name,
                "usage_count": pattern.usage_count,
                "success_rate": pattern.success_rate,
                "confidence": pattern.confidence
            })

        return MerchantPatternStats(
            total_patterns=len(patterns),
            active_patterns=len(active_patterns),
            total_usage=total_usage,
            average_confidence=avg_confidence,
            top_performing=top_performing
        )

    def learn_from_labeled_data(self, transactions: List[Dict[str, Any]]) -> List[MerchantPattern]:
        """Learn new patterns from labeled transaction data"""
        new_patterns = []

        # Group transactions by merchant and label
        merchant_labels = {}
        for transaction in transactions:
            if not transaction.get('label'):
                continue

            merchant = self.extract_merchant_from_description(
                str(transaction.get('Description', transaction.get('description', '')))
            )

            if merchant != 'UNKNOWN':
                key = f"{merchant}_{transaction['label']}"
                if key not in merchant_labels:
                    merchant_labels[key] = {
                        'merchant': merchant,
                        'label': transaction['label'],
                        'descriptions': [],
                        'count': 0
                    }

                merchant_labels[key]['descriptions'].append(
                    str(transaction.get('Description', transaction.get('description', '')))
                )
                merchant_labels[key]['count'] += 1

        # Create patterns for frequently occurring merchant-label combinations
        for key, data in merchant_labels.items():
            if data['count'] >= 3:  # Need at least 3 examples to create a pattern
                # Generate pattern from common description elements
                pattern = self._generate_pattern_from_descriptions(data['descriptions'])
                if pattern:
                    try:
                        new_pattern = self.create_pattern(MerchantPatternCreate(
                            name=data['merchant'],
                            pattern=pattern,
                            category=data['label'],
                            confidence=min(0.9, 0.5 + (data['count'] * 0.1))  # Higher confidence for more examples
                        ))
                        new_patterns.append(new_pattern)
                    except ValueError:
                        continue  # Skip invalid patterns

        return new_patterns

    def _generate_pattern_from_descriptions(self, descriptions: List[str]) -> Optional[str]:
        """Generate a regex pattern from a list of similar descriptions"""
        if len(descriptions) < 2:
            return None

        # Find common words across descriptions
        word_counts = {}
        for desc in descriptions:
            words = set(re.findall(r'\b\w+\b', desc.lower()))
            for word in words:
                if len(word) > 2:  # Only consider words longer than 2 characters
                    word_counts[word] = word_counts.get(word, 0) + 1

        # Find words that appear in most descriptions
        total_descs = len(descriptions)
        common_words = [
            word for word, count in word_counts.items()
            if count >= max(2, total_descs * 0.5)  # Appear in at least 50% of descriptions
        ]

        if len(common_words) >= 2:
            # Create pattern with common words
            pattern_parts = [re.escape(word) for word in common_words[:3]]  # Use top 3 words
            return r'\b(?:' + r'|'.join(pattern_parts) + r')\b'

        return None


# Global pattern manager instance
pattern_manager = MerchantPatternManager()
