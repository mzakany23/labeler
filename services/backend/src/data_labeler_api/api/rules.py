"""
Rules API endpoints for rule management and matching
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime

from ..models.rule import (
    Rule, RuleCreate, RuleUpdate, RulePreview, RuleValidation,
    RuleMatch
)
from ..models.transaction import Transaction
from ..services.rule_engine import rule_engine
from ..core.storage import storage_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rules", tags=["Rules"])

# In-memory rule storage for MVP (could be replaced with database)
rules_db: Dict[str, Rule] = {}


def get_rule_by_id(rule_id: str) -> Rule:
    """Get a rule by ID"""
    if rule_id not in rules_db:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rules_db[rule_id]


def save_rule(rule: Rule) -> Rule:
    """Save a rule to the database"""
    rules_db[rule.id] = rule
    return rule


def delete_rule(rule_id: str) -> bool:
    """Delete a rule from the database"""
    if rule_id in rules_db:
        del rules_db[rule_id]
        return True
    return False


@router.post("", response_model=Rule)
async def create_rule(rule_data: RuleCreate):
    """
    Create a new rule

    - **rule_data**: Rule configuration data
    """
    try:
        # Create new rule
        rule = Rule(
            **rule_data.dict(),
            id=f"rule_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{len(rules_db)}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            match_count=0,
            transaction_ids=[]
        )

        # Validate the rule
        validation = rule_engine.validate_rule(rule)
        if not validation.is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid rule configuration",
                    "errors": validation.errors,
                    "warnings": validation.warnings,
                    "suggestions": validation.suggestions
                }
            )

        # Save rule
        saved_rule = save_rule(rule)

        logger.info(f"Created rule: {rule.id}")
        return saved_rule

    except Exception as e:
        logger.error(f"Error creating rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")


@router.get("", response_model=List[Rule])
async def list_rules(
    active_only: bool = Query(False, description="Return only active rules"),
    limit: int = Query(100, description="Maximum number of rules to return"),
    offset: int = Query(0, description="Number of rules to skip")
):
    """
    List all rules

    - **active_only**: If true, return only active rules
    - **limit**: Maximum number of rules to return (default: 100)
    - **offset**: Number of rules to skip (default: 0)
    """
    try:
        rules = list(rules_db.values())

        # Filter active rules if requested
        if active_only:
            rules = [rule for rule in rules if rule.is_active]

        # Sort by priority (highest first), then by creation date
        rules.sort(key=lambda r: (-r.priority, r.created_at))

        # Apply pagination
        paginated_rules = rules[offset:offset + limit]

        return paginated_rules

    except Exception as e:
        logger.error(f"Error listing rules: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list rules: {str(e)}")


@router.get("/{rule_id}", response_model=Rule)
async def get_rule(rule_id: str):
    """
    Get a specific rule by ID

    - **rule_id**: Unique rule identifier
    """
    try:
        rule = get_rule_by_id(rule_id)
        return rule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get rule: {str(e)}")


@router.put("/{rule_id}", response_model=Rule)
async def update_rule(rule_id: str, updates: RuleUpdate):
    """
    Update an existing rule

    - **rule_id**: Unique rule identifier
    - **updates**: Fields to update
    """
    try:
        rule = get_rule_by_id(rule_id)

        # Apply updates
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(rule, field):
                setattr(rule, field, value)

        # Update timestamp
        rule.updated_at = datetime.utcnow()

        # Validate the updated rule
        validation = rule_engine.validate_rule(rule)
        if not validation.is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid rule configuration after update",
                    "errors": validation.errors,
                    "warnings": validation.warnings,
                    "suggestions": validation.suggestions
                }
            )

        # Save updated rule
        saved_rule = save_rule(rule)

        logger.info(f"Updated rule: {rule_id}")
        return saved_rule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update rule: {str(e)}")


@router.delete("/{rule_id}")
async def delete_rule_endpoint(rule_id: str):
    """
    Delete a rule

    - **rule_id**: Unique rule identifier
    """
    try:
        deleted = delete_rule(rule_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Rule not found")

        logger.info(f"Deleted rule: {rule_id}")
        return {"message": "Rule deleted successfully", "rule_id": rule_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete rule: {str(e)}")


@router.post("/{rule_id}/preview", response_model=RulePreview)
async def preview_rule(
    rule_id: str,
    file_id: str = Query(..., description="File ID to preview against"),
    max_samples: int = Query(10, description="Maximum number of sample matches to return")
):
    """
    Preview what transactions would match a rule

    - **rule_id**: Unique rule identifier
    - **file_id**: File ID containing transactions to check
    - **max_samples**: Maximum number of sample matches to return
    """
    try:
        rule = get_rule_by_id(rule_id)

        # Get transactions from file
        processed_data = storage_manager.get_processed_data(file_id)
        if not processed_data:
            raise HTTPException(status_code=404, detail="File not processed yet")

        transactions = processed_data.get("transactions", [])
        if not transactions:
            raise HTTPException(status_code=404, detail="No transactions found in file")

        # Preview rule matches
        preview = rule_engine.preview_rule(rule, transactions, max_samples)

        logger.info(f"Previewed rule {rule_id} against {len(transactions)} transactions")
        return preview

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to preview rule: {str(e)}")


@router.post("/{rule_id}/apply")
async def apply_rule(
    rule_id: str,
    file_id: str = Query(..., description="File ID to apply rule to"),
    transaction_ids: Optional[List[str]] = Body(None, description="Specific transaction IDs to apply rule to (optional)")
):
    """
    Apply a rule to transactions in a file

    - **rule_id**: Unique rule identifier
    - **file_id**: File ID containing transactions
    - **transaction_ids**: Optional list of specific transaction IDs to apply rule to
    """
    try:
        rule = get_rule_by_id(rule_id)

        # Get transactions from file
        processed_data = storage_manager.get_processed_data(file_id)
        if not processed_data:
            raise HTTPException(status_code=404, detail="File not processed yet")

        transactions = processed_data.get("transactions", [])

        # Find matching transactions
        matches = rule_engine.find_matching_transactions(rule, transactions)

        # Filter to specific transactions if provided
        if transaction_ids:
            matches = [m for m in matches if m.transaction_id in transaction_ids]

        # Apply the rule (update labels)
        updated_count = 0
        for match in matches:
            # Find the transaction
            transaction = next((t for t in transactions if str(t.get('id', '')) == match.transaction_id), None)
            if transaction and rule.label_id:
                transaction['label'] = rule.label_id
                transaction['label_confidence'] = match.confidence
                updated_count += 1

        # Save updated data
        storage_manager.save_processed_data(file_id, processed_data)

        # Update rule match count
        rule.match_count += updated_count
        rule.transaction_ids.extend([m.transaction_id for m in matches])
        save_rule(rule)

        logger.info(f"Applied rule {rule_id} to {updated_count} transactions")
        return {
            "message": f"Applied rule to {updated_count} transactions",
            "updated_count": updated_count,
            "rule_id": rule_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to apply rule: {str(e)}")


@router.post("/{rule_id}/validate", response_model=RuleValidation)
async def validate_rule_endpoint(rule_id: str):
    """
    Validate a rule for potential issues

    - **rule_id**: Unique rule identifier
    """
    try:
        rule = get_rule_by_id(rule_id)
        validation = rule_engine.validate_rule(rule)

        return validation

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate rule: {str(e)}")


@router.post("/create-from-transaction", response_model=Rule)
async def create_rule_from_transaction(
    file_id: str = Query(..., description="File ID containing the transaction"),
    transaction_id: str = Query(..., description="Transaction ID to create rule from"),
    label_id: str = Query(..., description="Label ID to apply"),
    rule_name: Optional[str] = Query(None, description="Optional rule name")
):
    """
    Create a rule based on a labeled transaction

    - **file_id**: File ID containing the transaction
    - **transaction_id**: Transaction ID to create rule from
    - **label_id**: Label ID to apply with the rule
    - **rule_name**: Optional custom rule name
    """
    try:
        # Get transactions from file
        processed_data = storage_manager.get_processed_data(file_id)
        if not processed_data:
            raise HTTPException(status_code=404, detail="File not processed yet")

        transactions = processed_data.get("transactions", [])

        # Find the transaction
        transaction = next((t for t in transactions if str(t.get('id', '')) == transaction_id), None)
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Create rule from transaction
        rule = rule_engine.create_rule_from_transaction(transaction, label_id, rule_name)

        # Save the rule
        saved_rule = save_rule(rule)

        logger.info(f"Created rule from transaction {transaction_id}: {rule.id}")
        return saved_rule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rule from transaction {transaction_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create rule from transaction: {str(e)}")


@router.post("/match", response_model=List[RuleMatch])
async def match_rules(
    file_id: str = Query(..., description="File ID containing transactions"),
    rule_ids: Optional[List[str]] = Query(None, description="Specific rule IDs to match (optional, matches all if not provided)"),
    limit: int = Query(100, description="Maximum number of matches to return")
):
    """
    Find all rule matches for transactions in a file

    - **file_id**: File ID containing transactions
    - **rule_ids**: Optional list of specific rule IDs to match
    - **limit**: Maximum number of matches to return
    """
    try:
        # Get transactions from file
        processed_data = storage_manager.get_processed_data(file_id)
        if not processed_data:
            raise HTTPException(status_code=404, detail="File not processed yet")

        transactions = processed_data.get("transactions", [])

        # Get rules to match
        if rule_ids:
            rules = [get_rule_by_id(rid) for rid in rule_ids if rid in rules_db]
        else:
            rules = [rule for rule in rules_db.values() if rule.is_active]

        if not rules:
            return []

        # Find all matches
        all_matches = []
        for rule in rules:
            matches = rule_engine.find_matching_transactions(rule, transactions)
            all_matches.extend(matches)

        # Sort by confidence (highest first) and limit results
        all_matches.sort(key=lambda m: m.confidence, reverse=True)
        limited_matches = all_matches[:limit]

        logger.info(f"Found {len(all_matches)} rule matches, returning {len(limited_matches)}")
        return limited_matches

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error matching rules: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to match rules: {str(e)}")
