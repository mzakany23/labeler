"""
Models package for Data Labeler API
"""

from .transaction import (
    Transaction,
    TransactionBase,
    TransactionCreate,
    TransactionUpdate,
    TransactionList,
    ColumnMapping,
    FileProcessingOptions,
    ProcessedFile
)

from .label import (
    Label,
    LabelBase,
    LabelCreate,
    LabelUpdate,
    LabelStats,
    LabelGroup,
    LabelRecommendation,
    BulkLabelOperation,
    LabelImportExport
)

from .file import (
    FileInfo,
    FileUploadResponse,
    FileProcessingStatus,
    ValidationError,
    ValidationReport,
    FileListResponse,
    FileStats,
    SessionInfo,
    FileDeleteResponse,
    ExportOptions,
    ExportResult
)

from .recommendation import (
    RecommendationConfig,
    TransactionRecommendation,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationStats,
    RecommendationFeedback,
    BulkRecommendationUpdate,
    RecommendationList,
    RecommendationMetrics,
    AlgorithmType
)

__all__ = [
    # Transaction models
    "Transaction",
    "TransactionBase",
    "TransactionCreate",
    "TransactionUpdate",
    "TransactionList",
    "ColumnMapping",
    "FileProcessingOptions",
    "ProcessedFile",

    # Label models
    "Label",
    "LabelBase",
    "LabelCreate",
    "LabelUpdate",
    "LabelStats",
    "LabelGroup",
    "LabelRecommendation",
    "BulkLabelOperation",
    "LabelImportExport",

    # File models
    "FileInfo",
    "FileUploadResponse",
    "FileProcessingStatus",
    "ValidationError",
    "ValidationReport",
    "FileListResponse",
    "FileStats",
    "SessionInfo",
    "FileDeleteResponse",
    "ExportOptions",
    "ExportResult",

    # Recommendation models
    "RecommendationConfig",
    "TransactionRecommendation",
    "RecommendationRequest",
    "RecommendationResponse",
    "RecommendationStats",
    "RecommendationFeedback",
    "BulkRecommendationUpdate",
    "RecommendationList",
    "RecommendationMetrics",
    "AlgorithmType",
]
