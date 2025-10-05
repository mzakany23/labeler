"""
File upload and management API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Optional
import logging
import os
from pathlib import Path

from ..core.config import get_settings
from ..core.storage import storage_manager
from ..models.file import (
    FileInfo,
    FileUploadResponse,
    FileListResponse,
    FileDeleteResponse,
    FileProcessingStatus,
    ValidationReport
)
from ..models.transaction import (
    ProcessedFile,
    FileProcessingOptions
)
from ..services.csv_processor import CSVProcessor

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/files", tags=["Files"])
csv_processor = CSVProcessor()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Upload a CSV file for processing

    - **file**: CSV file to upload (multipart form data)
    - **session_id**: Optional session identifier

    Returns file information after successful upload
    """
    # Validate file type
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported"
        )

    # Check file size
    file_size = 0
    content = await file.read()
    file_size = len(content)

    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds maximum limit of {settings.max_upload_size_mb}MB"
        )

    # Reset file pointer for further processing
    await file.seek(0)

    try:
        # Save file temporarily for processing
        temp_file_path = Path(f"/tmp/{file.filename}")
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Save to storage
        file_id = storage_manager.save_uploaded_file(
            temp_file_path,
            file.filename,
            session_id
        )

        # Clean up temp file
        if temp_file_path.exists():
            temp_file_path.unlink()

        # Get file info
        file_info = storage_manager.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=500, detail="Failed to save file information")

        # Convert to response model
        response = FileUploadResponse(
            file_id=file_info["file_id"],
            filename=file_info["original_filename"],
            session_id=file_info["session_id"],
            file_size=file_info["file_size"],
            uploaded_at=file_info["uploaded_at"],
            status="uploaded"
        )

        # Trigger background processing
        background_tasks.add_task(process_uploaded_file, file_id)

        logger.info(f"Successfully uploaded file: {file_id}")
        return response

    except Exception as e:
        logger.error(f"Error uploading file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("", response_model=FileListResponse)
async def list_files(
    session_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20
):
    """
    List uploaded files

    - **session_id**: Optional session filter
    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    """
    # Validate pagination parameters
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20

    # Get files from storage
    all_files = storage_manager.list_files(session_id)

    # Sort by upload time (newest first)
    all_files.sort(key=lambda x: x["uploaded_at"], reverse=True)

    # Apply pagination
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_files = all_files[start_idx:end_idx]

    # Convert to FileInfo models
    files = []
    for file_data in paginated_files:
        file_info = FileInfo(
            file_id=file_data["file_id"],
            filename=file_data["original_filename"],
            session_id=file_data["session_id"],
            file_size=file_data["file_size"],
            uploaded_at=file_data["uploaded_at"],
            processed_at=file_data.get("processed_at"),
            status=file_data.get("status", "uploaded"),
            mime_type=file_data.get("mime_type"),
            encoding=file_data.get("encoding")
        )
        files.append(file_info)

    return FileListResponse(
        files=files,
        total=len(all_files),
        page=page,
        per_page=per_page,
        has_more=end_idx < len(all_files)
    )


@router.get("/{file_id}", response_model=FileInfo)
async def get_file_info(file_id: str):
    """
    Get detailed information about a specific file

    - **file_id**: Unique file identifier
    """
    file_info = storage_manager.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    return FileInfo(
        file_id=file_info["file_id"],
        filename=file_info["original_filename"],
        session_id=file_info["session_id"],
        file_size=file_info["file_size"],
        uploaded_at=file_info["uploaded_at"],
        processed_at=file_info.get("processed_at"),
        status=file_info.get("status", "uploaded"),
        mime_type=file_info.get("mime_type"),
        encoding=file_info.get("encoding")
    )


@router.delete("/{file_id}", response_model=FileDeleteResponse)
async def delete_file(file_id: str):
    """
    Delete a file and all associated data

    - **file_id**: Unique file identifier
    """
    # Check if file exists
    file_info = storage_manager.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete file
    deleted = storage_manager.delete_file(file_id)

    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete file")

    return FileDeleteResponse(
        file_id=file_id,
        deleted=True,
        message="File deleted successfully"
    )


@router.get("/{file_id}/status", response_model=FileProcessingStatus)
async def get_file_status(file_id: str):
    """
    Get processing status of a file

    - **file_id**: Unique file identifier
    """
    file_info = storage_manager.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    # Determine status based on file info
    status = file_info.get("status", "uploaded")
    processed_at = file_info.get("processed_at")

    return FileProcessingStatus(
        file_id=file_id,
        status=status,
        progress=1.0 if processed_at else 0.0,
        message="File processed successfully" if processed_at else "File uploaded, processing pending",
        estimated_completion=processed_at
    )


@router.get("/{file_id}/validation", response_model=ValidationReport)
async def get_file_validation(file_id: str):
    """
    Get validation report for a processed file

    - **file_id**: Unique file identifier
    """
    # Get processed data which should contain validation report
    processed_data = storage_manager.get_processed_data(file_id)
    if not processed_data:
        raise HTTPException(status_code=404, detail="File not processed yet")

    validation_report = processed_data.get("validation_report")
    if not validation_report:
        raise HTTPException(status_code=404, detail="Validation report not found")

    return ValidationReport(**validation_report)


async def process_uploaded_file(file_id: str):
    """
    Background task to process uploaded CSV file

    Args:
        file_id: Unique file identifier
    """
    try:
        # Get file info
        file_info = storage_manager.get_file_info(file_id)
        if not file_info:
            logger.error(f"File info not found for {file_id}")
            return

        # Get file path
        file_path = storage_manager.get_file_path(file_id)
        if not file_path:
            logger.error(f"File path not found for {file_id}")
            return

        # Update status to processing
        file_info["status"] = "processing"
        storage_manager._file_registry[file_id] = file_info

        # Process the CSV file
        processed_file, transactions, validation_report = csv_processor.process_csv_file(
            str(file_path),
            file_id,
            FileProcessingOptions()
        )

        # Save processed data
        processed_data = {
            "file_id": file_id,
            "processed_file": processed_file.dict(),
            "transactions": [t.dict() for t in transactions],
            "validation_report": validation_report.dict(),
            "processed_at": processed_file.created_at.isoformat()
        }

        storage_manager.save_processed_data(file_id, processed_data)

        # Update file info
        file_info["status"] = "completed"
        file_info["processed_at"] = processed_file.created_at.isoformat()
        file_info["validation_report"] = validation_report.dict()
        storage_manager._file_registry[file_id] = file_info

        logger.info(f"Successfully processed file: {file_id}")

    except Exception as e:
        logger.error(f"Error processing file {file_id}: {e}")

        # Update file info with error status
        if file_id in storage_manager._file_registry:
            file_info = storage_manager._file_registry[file_id]
            file_info["status"] = "failed"
            file_info["error"] = str(e)
            storage_manager._file_registry[file_id] = file_info
