"""
Pydantic models for file management
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field
from datetime import datetime
from pathlib import Path


class FileInfo(BaseModel):
    """File information model"""
    file_id: str = Field(..., description="Unique file identifier")
    filename: str = Field(..., description="Original filename")
    session_id: str = Field(..., description="Upload session ID")
    file_size: int = Field(..., description="File size in bytes")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    processed_at: Optional[datetime] = Field(None, description="Processing completion timestamp")
    status: str = Field(default="uploaded", description="File processing status")
    mime_type: Optional[str] = Field(None, description="MIME type")
    encoding: Optional[str] = Field(None, description="Detected file encoding")


class FileUploadResponse(BaseModel):
    """Response after successful file upload"""
    file_id: str = Field(..., description="Unique file identifier")
    filename: str = Field(..., description="Original filename")
    session_id: str = Field(..., description="Upload session ID")
    file_size: int = Field(..., description="File size in bytes")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    status: str = Field(..., description="Current status")


class FileProcessingStatus(BaseModel):
    """File processing status"""
    file_id: str = Field(..., description="File identifier")
    status: str = Field(..., description="Current status (uploaded, processing, completed, failed)")
    progress: float = Field(0.0, ge=0.0, le=1.0, description="Processing progress (0.0-1.0)")
    message: Optional[str] = Field(None, description="Status message")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")


class ValidationError(BaseModel):
    """Individual validation error"""
    row: int = Field(..., description="Row number (1-based)")
    column: Optional[str] = Field(None, description="Column name")
    value: Any = Field(..., description="Invalid value")
    error_type: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")


class ValidationReport(BaseModel):
    """CSV validation report"""
    is_valid: bool = Field(..., description="Overall validation result")
    total_rows: int = Field(..., description="Total number of rows")
    valid_rows: int = Field(..., description="Number of valid rows")
    invalid_rows: int = Field(..., description="Number of invalid rows")
    errors: List[ValidationError] = Field(default_factory=list, description="List of validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    column_info: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Column analysis")

    @property
    def error_rate(self) -> float:
        """Calculate error rate as percentage"""
        if self.total_rows == 0:
            return 0.0
        return (self.invalid_rows / self.total_rows) * 100.0

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage"""
        if self.total_rows == 0:
            return 0.0
        return (self.valid_rows / self.total_rows) * 100.0


class FileListResponse(BaseModel):
    """Response for listing files"""
    files: List[FileInfo] = Field(..., description="List of uploaded files")
    total: int = Field(..., description="Total number of files")
    page: int = Field(default=1, description="Current page")
    per_page: int = Field(default=20, description="Files per page")
    has_more: bool = Field(..., description="Whether there are more files")


class FileStats(BaseModel):
    """File statistics"""
    total_files: int = Field(..., description="Total number of uploaded files")
    total_size: int = Field(..., description="Total size of all files in bytes")
    files_by_status: Dict[str, int] = Field(..., description="Files grouped by status")
    recent_uploads: List[FileInfo] = Field(default_factory=list, description="Recently uploaded files")


class SessionInfo(BaseModel):
    """Upload session information"""
    session_id: str = Field(..., description="Session identifier")
    created_at: datetime = Field(..., description="Session creation time")
    file_count: int = Field(..., description="Number of files in session")
    total_size: int = Field(..., description="Total size of all files in session")
    files: List[FileInfo] = Field(..., description="Files in this session")


class FileDeleteResponse(BaseModel):
    """Response after deleting a file"""
    file_id: str = Field(..., description="Deleted file ID")
    deleted: bool = Field(..., description="Whether deletion was successful")
    message: str = Field(..., description="Status message")


class ExportOptions(BaseModel):
    """Options for exporting labeled data"""
    format: str = Field(default="csv", pattern=r'^(csv|parquet|json)$', description="Export format")
    include_headers: bool = Field(default=True, description="Include column headers")
    date_range: Optional[Dict[str, datetime]] = Field(None, description="Date range filter")
    labels: Optional[List[str]] = Field(None, description="Label filter")
    columns: Optional[List[str]] = Field(None, description="Columns to include")


class ExportResult(BaseModel):
    """Result of data export operation"""
    export_id: str = Field(..., description="Export operation ID")
    file_id: str = Field(..., description="Source file ID")
    format: str = Field(..., description="Export format")
    filename: str = Field(..., description="Generated filename")
    file_size: int = Field(..., description="Export file size")
    record_count: int = Field(..., description="Number of records exported")
    created_at: datetime = Field(..., description="Export timestamp")
