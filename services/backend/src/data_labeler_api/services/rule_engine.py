"""
Enhanced rule engine service for server-side rule matching and recommendations
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import uuid

from ..models.rule import Rule, RuleMatch, RulePreview, RuleValidation
from ..models.transaction import Transaction
from ..models.configuration import config_manager
from ..services.merchant_patterns import pattern_manager

logger = logging.getLogger(__name__)


class RuleEngine:
    """Enhanced rule engine for server-side processing"""

    def __init__(self):
        self.compiled_patterns = {}  # Cache for compiled regex patterns

    def extract_merchant(self, description: str) -> str:
        """Extract merchant name from transaction description using configurable patterns"""
        if not description:
            return 'UNKNOWN'

        # Use the pattern manager to extract merchant
        return pattern_manager.extract_merchant_from_description(description)

    def _clean_description(self, description: str, domain_config: str = None) -> str:
        """Clean description using domain-specific configuration"""
        if not description:
            return ''

        cleaned = description

        # Get domain configuration
        config = config_manager.get_config(domain_config) if domain_config else config_manager.get_active_config()

        if config and config.cleaning_patterns:
            # Apply domain-specific cleaning patterns
            for cleaning_pattern in config.cleaning_patterns:
                try:
                    cleaned = re.sub(cleaning_pattern.pattern, cleaning_pattern.replacement, cleaned, flags=re.IGNORECASE)
                except re.error:
                    logger.warning(f"Invalid cleaning pattern: {cleaning_pattern.pattern}")
                    continue
        else:
            # Apply minimal generic cleaning if no domain config
            cleaned = re.sub(r'\s*[\d*#]+\s*$', '', cleaned)  # Remove trailing numbers/special chars
            cleaned = re.sub(r'\s+REF\s*[:#]?\s*\w+.*$', '', cleaned, flags=re.IGNORECASE)  # Remove references

        return cleaned.strip()

    def generate_regex_pattern(self, text: str, fuzzy: bool = True) -> str:
        """Generate regex pattern from text with smart escaping"""
        if not text:
            return ''

        # Escape special regex characters
        escaped = re.escape(text)

        if fuzzy:
            # For fuzzy matching, use word boundaries
            flexible = escaped.replace(r'\ ', r'[\\s\\-_]+')
            return f'\\b{flexible}\\b'
        else:
            # For exact matching, use strict word boundaries
            semi_flexible = escaped.replace(r'\ ', r'[\\s\\-_]*')
            return f'\\b{semi_flexible}\\b'

    def match_rule_against_transaction(self, rule: Rule, transaction: Dict[str, Any]) -> Optional[RuleMatch]:
        """Check if a rule matches a transaction"""
        if not rule.is_active:
            return None

        description = str(transaction.get('Description', transaction.get('description', '')))
        amount = float(transaction.get('Amount', transaction.get('amount', 0)) or 0)
        date_str = transaction.get('Date', transaction.get('date', ''))
        category = str(transaction.get('Category', transaction.get('category', '')))

        date = None
        if date_str:
            try:
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass

        matched_conditions = []

        # Check merchant condition
        if rule.conditions.merchant:
            merchant = self.extract_merchant(description)
            merchant_pattern = self.generate_regex_pattern(rule.conditions.merchant, False)
            if re.search(merchant_pattern, merchant, re.IGNORECASE):
                matched_conditions.append('merchant')

        # Check description condition
        if rule.conditions.description:
            description_pattern = self.generate_regex_pattern(rule.conditions.description, False)
            if re.search(description_pattern, description, re.IGNORECASE):
                matched_conditions.append('description')

        # Check amount conditions
        if rule.conditions.amount:
            amount_conditions = rule.conditions.amount

            if 'exact' in amount_conditions and amount_conditions['exact'] is not None:
                exact = float(amount_conditions['exact'])
                if abs(amount - exact) <= 0.01:  # Small tolerance for floating point
                    matched_conditions.append('amount_exact')

            if 'min' in amount_conditions and amount_conditions['min'] is not None:
                min_amount = float(amount_conditions['min'])
                if amount >= min_amount:
                    matched_conditions.append('amount_min')

            if 'max' in amount_conditions and amount_conditions['max'] is not None:
                max_amount = float(amount_conditions['max'])
                if amount <= max_amount:
                    matched_conditions.append('amount_max')

        # Check category condition
        if rule.conditions.category:
            category_pattern = self.generate_regex_pattern(rule.conditions.category, False)
            if re.search(category_pattern, category, re.IGNORECASE):
                matched_conditions.append('category')

        # Check date range conditions
        if rule.conditions.date_range and date:
            date_conditions = rule.conditions.date_range

            if 'start' in date_conditions and date_conditions['start']:
                start_date = datetime.fromisoformat(date_conditions['start'])
                if date >= start_date:
                    matched_conditions.append('date_start')

            if 'end' in date_conditions and date_conditions['end']:
                end_date = datetime.fromisoformat(date_conditions['end'])
                if date <= end_date:
                    matched_conditions.append('date_end')

        # If any conditions matched, return the match result
        if matched_conditions:
            # Calculate confidence based on how many conditions matched
            confidence = len(matched_conditions) / max(len([c for c in rule.conditions.__dict__.values() if c]), 1)

            return RuleMatch(
                rule_id=rule.id,
                transaction_id=str(transaction.get('id', '')),
                confidence=min(confidence, rule.confidence),
                matched_conditions=matched_conditions
            )

        return None

    def find_matching_transactions(self, rule: Rule, transactions: List[Dict[str, Any]]) -> List[RuleMatch]:
        """Find all transactions that match a rule"""
        matches = []

        for transaction in transactions:
            match = self.match_rule_against_transaction(rule, transaction)
            if match:
                matches.append(match)

        return matches

    def preview_rule(self, rule: Rule, transactions: List[Dict[str, Any]], max_samples: int = 10) -> RulePreview:
        """Preview what transactions would match a rule"""
        matches = self.find_matching_transactions(rule, transactions)

        # Get sample matches for preview
        sample_matches = []
        for match in matches[:max_samples]:
            transaction = next((t for t in transactions if str(t.get('id', '')) == match.transaction_id), None)
            if transaction:
                sample_matches.append(transaction)

        return RulePreview(
            rule=rule,
            matching_transactions=sample_matches,
            total_matches=len(matches),
            sample_matches=sample_matches
        )

    def validate_rule(self, rule: Rule) -> RuleValidation:
        """Validate a rule for potential issues"""
        errors = []
        warnings = []
        suggestions = []

        # Check if rule has any conditions
        has_conditions = (
            rule.conditions.merchant or
            rule.conditions.description or
            rule.conditions.amount or
            rule.conditions.category or
            rule.conditions.date_range
        )

        if not has_conditions:
            errors.append("Rule must have at least one condition")

        # Check regex patterns for validity
        if rule.regex.merchant:
            try:
                re.compile(rule.regex.merchant, re.IGNORECASE)
            except re.error as e:
                errors.append(f"Invalid merchant regex pattern: {e}")

        if rule.regex.description:
            try:
                re.compile(rule.regex.description, re.IGNORECASE)
            except re.error as e:
                errors.append(f"Invalid description regex pattern: {e}")

        # Check amount conditions
        if rule.conditions.amount:
            amount = rule.conditions.amount
            if 'min' in amount and 'max' in amount:
                if amount['min'] > amount['max']:
                    errors.append("Minimum amount cannot be greater than maximum amount")

        # Check confidence threshold
        if rule.confidence < 0.1:
            warnings.append("Very low confidence threshold may result in poor matches")
        elif rule.confidence > 0.9:
            warnings.append("Very high confidence threshold may miss valid matches")

        # Check priority
        if rule.priority < 0:
            warnings.append("Negative priority may cause unexpected rule ordering")

        # Suggestions for improvement
        if not rule.conditions.merchant and not rule.regex.merchant:
            suggestions.append("Consider adding merchant condition for better accuracy")

        if not rule.conditions.amount and not rule.regex.description:
            suggestions.append("Consider adding amount or description conditions")

        return RuleValidation(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )

    def create_rule_from_transaction(self, transaction: Dict[str, Any], label_id: str, rule_name: str = None) -> Rule:
        """Create a rule based on a labeled transaction"""
        description = str(transaction.get('Description', transaction.get('description', '')))
        amount = float(transaction.get('Amount', transaction.get('amount', 0)) or 0)

        merchant = self.extract_merchant(description)

        # Create rule name if not provided
        if not rule_name:
            rule_name = f"Auto-rule for {merchant or 'transaction'}"

        # Analyze patterns for the transaction
        patterns = self._analyze_transaction_patterns(transaction)

        return Rule(
            id=f"rule_{uuid.uuid4().hex[:8]}",
            name=rule_name,
            conditions={
                'merchant': merchant,
                'amount': patterns.get('amount_pattern'),
                'description': description,
            },
            regex={
                'merchant': patterns.get('merchant_patterns', [None])[0],
                'description': patterns.get('description_patterns', [None])[0],
            },
            label_id=label_id,
            priority=0,
            is_active=True,
            confidence=0.7,  # Default confidence
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            created_from=str(transaction.get('id', '')),
            match_count=0,
            transaction_ids=[]
        )

    def _analyze_transaction_patterns(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze transaction to extract patterns for rule creation"""
        description = str(transaction.get('Description', transaction.get('description', '')))
        amount = float(transaction.get('Amount', transaction.get('amount', 0)) or 0)

        merchant = self.extract_merchant(description)

        patterns = {
            'merchant_patterns': [],
            'description_patterns': [],
            'amount_pattern': None
        }

        # Create merchant pattern
        if merchant and merchant != 'UNKNOWN':
            pattern = self.generate_regex_pattern(merchant, False)
            patterns['merchant_patterns'].append(pattern)

        # Amount pattern
        if amount != 0:
            rounded_amount = round(amount * 100) / 100
            patterns['amount_pattern'] = {
                'exact': rounded_amount,
                'min': rounded_amount * 0.95,  # 5% tolerance
                'max': rounded_amount * 1.05,
            }

        return patterns


# Global rule engine instance
rule_engine = RuleEngine()
