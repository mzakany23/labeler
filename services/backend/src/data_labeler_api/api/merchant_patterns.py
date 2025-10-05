"""
Merchant patterns API endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from ..models.merchant_patterns import (
    MerchantPattern, MerchantPatternCreate, MerchantPatternUpdate,
    MerchantPatternStats
)
from ..services.merchant_patterns import pattern_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/merchant-patterns", tags=["Merchant Patterns"])


@router.post("", response_model=MerchantPattern)
async def create_merchant_pattern(pattern_data: MerchantPatternCreate):
    """
    Create a new merchant pattern

    - **pattern_data**: Pattern configuration data
    """
    try:
        pattern = pattern_manager.create_pattern(pattern_data)
        return pattern
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating merchant pattern: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create pattern: {str(e)}")


@router.get("", response_model=List[MerchantPattern])
async def list_merchant_patterns(
    active_only: bool = Query(True, description="Return only active patterns"),
    limit: int = Query(100, description="Maximum number of patterns to return"),
    offset: int = Query(0, description="Number of patterns to skip")
):
    """
    List merchant patterns

    - **active_only**: If true, return only active patterns
    - **limit**: Maximum number of patterns to return (default: 100)
    - **offset**: Number of patterns to skip (default: 0)
    """
    try:
        patterns = pattern_manager.list_patterns(active_only)

        # Apply pagination
        paginated_patterns = patterns[offset:offset + limit]

        return paginated_patterns
    except Exception as e:
        logger.error(f"Error listing merchant patterns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list patterns: {str(e)}")


@router.get("/{pattern_id}", response_model=MerchantPattern)
async def get_merchant_pattern(pattern_id: str):
    """
    Get a specific merchant pattern by ID

    - **pattern_id**: Unique pattern identifier
    """
    try:
        pattern = pattern_manager.get_pattern(pattern_id)
        if not pattern:
            raise HTTPException(status_code=404, detail="Pattern not found")

        return pattern
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting merchant pattern {pattern_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get pattern: {str(e)}")


@router.put("/{pattern_id}", response_model=MerchantPattern)
async def update_merchant_pattern(pattern_id: str, updates: MerchantPatternUpdate):
    """
    Update an existing merchant pattern

    - **pattern_id**: Unique pattern identifier
    - **updates**: Fields to update
    """
    try:
        pattern = pattern_manager.update_pattern(pattern_id, updates)
        return pattern
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating merchant pattern {pattern_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update pattern: {str(e)}")


@router.delete("/{pattern_id}")
async def delete_merchant_pattern(pattern_id: str):
    """
    Delete a merchant pattern

    - **pattern_id**: Unique pattern identifier
    """
    try:
        deleted = pattern_manager.delete_pattern(pattern_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Pattern not found")

        return {"message": "Pattern deleted successfully", "pattern_id": pattern_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting merchant pattern {pattern_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete pattern: {str(e)}")


@router.post("/learn-from-data")
async def learn_patterns_from_data(
    file_id: str = Query(..., description="File ID containing labeled transactions")
):
    """
    Learn new merchant patterns from labeled transaction data

    - **file_id**: File ID containing transactions to learn from
    """
    try:
        # This would need access to the storage manager to get transactions
        # For now, return a placeholder response
        return {
            "message": "Pattern learning not yet implemented",
            "new_patterns_count": 0,
            "file_id": file_id
        }
    except Exception as e:
        logger.error(f"Error learning patterns from data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to learn patterns: {str(e)}")


@router.get("/stats", response_model=MerchantPatternStats)
async def get_merchant_pattern_stats():
    """
    Get statistics about merchant patterns
    """
    try:
        stats = pattern_manager.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting merchant pattern stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.post("/test-pattern")
async def test_merchant_pattern(
    pattern_id: str = Query(..., description="Pattern ID to test"),
    description: str = Query(..., description="Transaction description to test against")
):
    """
    Test a merchant pattern against a description

    - **pattern_id**: Pattern ID to test
    - **description**: Transaction description to test
    """
    try:
        pattern = pattern_manager.get_pattern(pattern_id)
        if not pattern:
            raise HTTPException(status_code=404, detail="Pattern not found")

        merchant = pattern_manager.extract_merchant_from_description(description)

        return {
            "pattern_id": pattern_id,
            "pattern_name": pattern.name,
            "description": description,
            "extracted_merchant": merchant,
            "matched": merchant != 'UNKNOWN'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing merchant pattern {pattern_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test pattern: {str(e)}")
