"""
Pydantic models for recommendation system
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class AlgorithmType(str, Enum):
    """Types of recommendation algorithms"""
    EXACT_MATCH = "exact_match"
    FUZZY_MATCH = "fuzzy_match"
    MERCHANT_PATTERN = "merchant_pattern"
    AMOUNT_PATTERN = "amount_pattern"
    ML_MODEL = "ml_model"


class RecommendationConfig(BaseModel):
    """Configuration for recommendation generation"""
    exact_match_weight: float = Field(1.0, ge=0.0, le=1.0, description="Weight for exact match algorithm")
    fuzzy_match_weight: float = Field(0.8, ge=0.0, le=1.0, description="Weight for fuzzy match algorithm")
    merchant_pattern_weight: float = Field(0.7, ge=0.0, le=1.0, description="Weight for merchant pattern algorithm")
    amount_pattern_weight: float = Field(0.6, ge=0.0, le=1.0, description="Weight for amount pattern algorithm")
    minimum_confidence: float = Field(0.6, ge=0.0, le=1.0, description="Minimum confidence threshold")
    max_recommendations_per_row: int = Field(3, gt=0, description="Maximum recommendations per transaction")


class TransactionRecommendation(BaseModel):
    """Recommendation for a single transaction"""
    transaction_id: str = Field(..., description="Transaction ID")
    recommendations: List[Dict[str, Any]] = Field(..., description="List of label recommendations")
    best_match: Optional[Dict[str, Any]] = Field(None, description="Best matching recommendation")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall confidence score")


class RecommendationRequest(BaseModel):
    """Request for generating recommendations"""
    file_id: str = Field(..., description="File ID to generate recommendations for")
    config: Optional[RecommendationConfig] = Field(None, description="Recommendation configuration")
    labeled_transactions: Optional[List[Dict[str, Any]]] = Field(None, description="Previously labeled transactions for context")
    include_patterns: bool = Field(default=True, description="Include pattern-based recommendations")
    include_similar: bool = Field(default=True, description="Include similarity-based recommendations")


class RecommendationResponse(BaseModel):
    """Response from recommendation generation"""
    recommendation_id: str = Field(..., description="Unique recommendation ID")
    file_id: str = Field(..., description="Source file ID")
    generated_at: datetime = Field(..., description="Generation timestamp")
    config_used: RecommendationConfig = Field(..., description="Configuration used for generation")
    recommendations: List[TransactionRecommendation] = Field(..., description="Recommendations for each transaction")
    stats: Dict[str, Any] = Field(..., description="Generation statistics")


class RecommendationStats(BaseModel):
    """Statistics about recommendation generation"""
    total_transactions: int = Field(..., description="Total transactions processed")
    recommendations_generated: int = Field(..., description="Total recommendations created")
    avg_confidence: float = Field(..., description="Average confidence score")
    high_confidence_count: int = Field(..., description="Transactions with high confidence (>0.8)")
    medium_confidence_count: int = Field(..., description="Transactions with medium confidence (0.5-0.8)")
    low_confidence_count: int = Field(..., description="Transactions with low confidence (<0.5)")
    algorithm_usage: Dict[str, int] = Field(..., description="Usage count by algorithm")
    processing_time_seconds: float = Field(..., description="Total processing time")


class RecommendationFeedback(BaseModel):
    """User feedback on recommendations"""
    recommendation_id: str = Field(..., description="Recommendation ID")
    transaction_id: str = Field(..., description="Transaction ID")
    label_id: str = Field(..., description="Applied label ID")
    accepted: bool = Field(..., description="Whether recommendation was accepted")
    user_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="User's confidence in the recommendation")
    feedback_text: Optional[str] = Field(None, description="Additional feedback text")


class BulkRecommendationUpdate(BaseModel):
    """Bulk update of recommendations"""
    recommendation_id: str = Field(..., description="Recommendation ID")
    updates: List[Dict[str, Any]] = Field(..., description="List of transaction updates")
    applied_by: str = Field(..., description="User who applied the updates")


class RecommendationList(BaseModel):
    """List of recommendations"""
    recommendations: List[RecommendationResponse] = Field(..., description="List of recommendations")
    total: int = Field(..., description="Total number of recommendations")
    page: int = Field(default=1, description="Current page")
    per_page: int = Field(default=20, description="Recommendations per page")


class RecommendationMetrics(BaseModel):
    """Metrics about recommendation system performance"""
    total_recommendations: int = Field(..., description="Total recommendations generated")
    acceptance_rate: float = Field(..., description="Percentage of recommendations accepted")
    avg_confidence_accepted: float = Field(..., description="Average confidence of accepted recommendations")
    avg_confidence_rejected: float = Field(..., description="Average confidence of rejected recommendations")
    most_used_algorithms: List[str] = Field(..., description="Most frequently used algorithms")
    label_distribution: Dict[str, int] = Field(..., description="Distribution of recommended labels")
