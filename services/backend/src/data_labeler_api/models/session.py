"""
Session models for state persistence
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum


class StorageType(str, Enum):
    """Storage type for session"""
    LOCAL = "local"
    BACKEND = "backend"
    HYBRID = "hybrid"


class SyncStatus(str, Enum):
    """Sync status for session"""
    SYNCED = "synced"
    PENDING = "pending"
    CONFLICT = "conflict"
    ERROR = "error"


class SessionMetadata(BaseModel):
    """Metadata about a persisted session"""
    session_id: str = Field(..., alias="sessionId")
    file_name: Optional[str] = Field(None, alias="fileName")
    last_modified: datetime = Field(..., alias="lastModified")
    row_count: int = Field(0, alias="rowCount")
    label_count: int = Field(0, alias="labelCount")
    rule_count: int = Field(0, alias="ruleCount")
    storage_type: StorageType = Field(StorageType.BACKEND, alias="storageType")
    sync_status: Optional[SyncStatus] = Field(None, alias="syncStatus")
    last_synced_at: Optional[datetime] = Field(None, alias="lastSyncedAt")
    version: Optional[str] = None

    class Config:
        populate_by_name = True
        use_enum_values = True


class PersistedState(BaseModel):
    """Complete persisted state structure"""
    session_id: str = Field(..., alias="sessionId")
    data_state: Dict[str, Any] = Field(..., alias="dataState")
    active_tab: str = Field(..., alias="activeTab")
    metadata: SessionMetadata
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        populate_by_name = True


class SessionCreate(BaseModel):
    """Request to create/update a session"""
    session_id: str = Field(..., alias="sessionId")
    data_state: Dict[str, Any] = Field(..., alias="dataState")
    active_tab: str = Field(..., alias="activeTab")
    metadata: SessionMetadata
    type: str = "data"  # data, labels, or rules

    class Config:
        populate_by_name = True


class SessionResponse(BaseModel):
    """Response for session operations"""
    success: bool
    session_id: str = Field(..., alias="sessionId")
    timestamp: datetime
    error: Optional[str] = None
    metadata: Optional[SessionMetadata] = None

    class Config:
        populate_by_name = True
