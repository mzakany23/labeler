"""
Rule models for the recommendation engine
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class RuleCondition(BaseModel):
    """Advanced rule condition model"""
    description: Optional[str] = None
    merchant: Optional[str] = None
    amount: Optional[Dict[str, float]] = None  # min, max, exact
    category: Optional[str] = None
    date_range: Optional[Dict[str, str]] = None  # start, end dates


class RuleRegex(BaseModel):
    """Regex patterns for rule matching"""
    description: Optional[str] = None
    merchant: Optional[str] = None


class RuleBase(BaseModel):
    """Base rule model"""
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")
    conditions: RuleCondition = Field(default_factory=RuleCondition)
    regex: RuleRegex = Field(default_factory=RuleRegex)
    label_id: Optional[str] = Field(None, description="Label to apply")
    priority: int = Field(0, description="Rule priority (higher = more important)")
    is_active: bool = Field(True, description="Whether rule is active")
    confidence: float = Field(0.5, ge=0.0, le=1.0, description="Confidence threshold")


class RuleCreate(RuleBase):
    """Model for creating new rules"""
    pass


class RuleUpdate(BaseModel):
    """Model for updating existing rules"""
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[RuleCondition] = None
    regex: Optional[RuleRegex] = None
    label_id: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    confidence: Optional[float] = None


class Rule(RuleBase):
    """Complete rule model"""
    id: str = Field(..., description="Unique rule identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_from: Optional[str] = Field(None, description="Transaction that created this rule")
    match_count: int = Field(0, description="Number of times this rule has matched")
    transaction_ids: List[str] = Field(default_factory=list, description="Transactions this rule has been applied to")


class RuleMatch(BaseModel):
    """Result of rule matching"""
    rule_id: str
    transaction_id: str
    confidence: float
    matched_conditions: List[str] = Field(default_factory=list)


class RulePreview(BaseModel):
    """Preview of rule matches"""
    rule: Rule
    matching_transactions: List[Dict[str, Any]] = Field(default_factory=list)
    total_matches: int = Field(0, description="Total number of matching transactions")
    sample_matches: List[Dict[str, Any]] = Field(default_factory=list, description="Sample of matching transactions")


class RuleValidation(BaseModel):
    """Rule validation result"""
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
