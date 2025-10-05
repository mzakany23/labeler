"""
Pydantic models for label management
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime


class LabelBase(BaseModel):
    """Base label model"""
    name: str = Field(..., min_length=1, max_length=100, description="Label name")
    color: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code (e.g., #FF5733)")
    description: Optional[str] = Field(None, max_length=500, description="Label description")
    category: Optional[str] = Field(None, max_length=100, description="Label category/group")
    is_system: bool = Field(default=False, description="Whether this is a system-generated label")


class Label(LabelBase):
    """Label with ID and metadata"""
    id: str = Field(..., description="Unique label identifier")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    usage_count: int = Field(default=0, description="Number of transactions using this label")


class LabelCreate(LabelBase):
    """Model for creating new labels"""
    pass


class LabelUpdate(BaseModel):
    """Model for updating labels"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)


class LabelStats(BaseModel):
    """Statistics for a label"""
    label_id: str = Field(..., description="Label identifier")
    usage_count: int = Field(..., description="Number of transactions with this label")
    total_amount: float = Field(..., description="Sum of all transaction amounts")
    avg_amount: float = Field(..., description="Average transaction amount")
    first_used: Optional[datetime] = Field(None, description="First time label was used")
    last_used: Optional[datetime] = Field(None, description="Last time label was used")


class LabelGroup(BaseModel):
    """Group of related labels"""
    id: str = Field(..., description="Group identifier")
    name: str = Field(..., min_length=1, max_length=100, description="Group name")
    description: Optional[str] = Field(None, max_length=500, description="Group description")
    labels: List[Label] = Field(default_factory=list, description="Labels in this group")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")


class LabelRecommendation(BaseModel):
    """Recommendation for labeling a transaction"""
    label_id: str = Field(..., description="Recommended label ID")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")
    reason: str = Field(..., description="Explanation for the recommendation")
    algorithm: str = Field(..., description="Algorithm used for recommendation")
    matched_transactions: List[str] = Field(default_factory=list, description="IDs of similar transactions")


class BulkLabelOperation(BaseModel):
    """Bulk labeling operation"""
    transaction_ids: List[str] = Field(..., description="Transaction IDs to label")
    label_id: str = Field(..., description="Label to apply")
    operation: str = Field(..., pattern=r'^(apply|remove)$', description="Operation type")


class LabelImportExport(BaseModel):
    """Import/export format for labels"""
    labels: List[Label] = Field(..., description="List of labels")
    groups: List[LabelGroup] = Field(default_factory=list, description="Label groups")
    version: str = Field(default="1.0", description="Export format version")
    exported_at: datetime = Field(default_factory=datetime.utcnow, description="Export timestamp")
