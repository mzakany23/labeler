"""
Merchant patterns configuration models
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class MerchantPatternBase(BaseModel):
    """Base merchant pattern model"""
    name: str = Field(..., description="Merchant name")
    pattern: str = Field(..., description="Regex pattern to match merchant")
    category: Optional[str] = Field(None, description="Merchant category")
    confidence: float = Field(0.8, ge=0.0, le=1.0, description="Confidence score for this pattern")
    is_active: bool = Field(True, description="Whether pattern is active")


class MerchantPatternCreate(MerchantPatternBase):
    """Model for creating merchant patterns"""
    pass


class MerchantPatternUpdate(BaseModel):
    """Model for updating merchant patterns"""
    name: Optional[str] = None
    pattern: Optional[str] = None
    category: Optional[str] = None
    confidence: Optional[float] = None
    is_active: Optional[bool] = None


class MerchantPattern(MerchantPatternBase):
    """Complete merchant pattern model"""
    id: str = Field(..., description="Unique pattern identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="User who created this pattern")
    usage_count: int = Field(0, description="How many times this pattern has been used")
    success_rate: float = Field(0.0, description="Success rate of pattern matches")


class MerchantPatternStats(BaseModel):
    """Statistics for merchant pattern performance"""
    total_patterns: int
    active_patterns: int
    total_usage: int
    average_confidence: float
    top_performing: List[Dict[str, Any]] = Field(default_factory=list)
