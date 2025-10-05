"""
Sessions API endpoints for state persistence
"""

from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from typing import List, Optional
import logging
from datetime import datetime
import json
from pathlib import Path

from ..models.session import (
    PersistedState,
    SessionMetadata,
    SessionCreate,
    SessionResponse,
    StorageType,
    SyncStatus
)
from ..core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# Session storage directory
SESSIONS_DIR = Path(settings.data_dir) / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

ACTIVE_SESSION_FILE = SESSIONS_DIR / "active_session.txt"


def get_session_file(session_id: str) -> Path:
    """Get the file path for a session"""
    return SESSIONS_DIR / f"{session_id}.json"


def load_session_from_file(session_id: str) -> Optional[PersistedState]:
    """Load a session from file"""
    try:
        session_file = get_session_file(session_id)
        if not session_file.exists():
            return None

        with open(session_file, 'r') as f:
            data = json.load(f)
            return PersistedState(**data)
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        return None


def save_session_to_file(session: PersistedState) -> bool:
    """Save a session to file"""
    try:
        session_file = get_session_file(session.session_id)
        with open(session_file, 'w') as f:
            json.dump(session.dict(by_alias=True), f, default=str, indent=2)
        return True
    except Exception as e:
        logger.error(f"Failed to save session {session.session_id}: {e}")
        return False


def delete_session_file(session_id: str) -> bool:
    """Delete a session file"""
    try:
        session_file = get_session_file(session_id)
        if session_file.exists():
            session_file.unlink()
        return True
    except Exception as e:
        logger.error(f"Failed to delete session {session_id}: {e}")
        return False


@router.post("/{session_id}", response_model=SessionResponse)
async def create_or_update_session(
    session_id: str,
    session_data: SessionCreate = Body(...)
):
    """
    Create or update a session

    - **session_id**: Unique session identifier
    - **session_data**: Session data to persist
    """
    try:
        now = datetime.utcnow()

        # Load existing session if it exists
        existing = load_session_from_file(session_id)

        # Create persisted state
        persisted_state = PersistedState(
            session_id=session_id,
            data_state=session_data.data_state,
            active_tab=session_data.active_tab,
            metadata=SessionMetadata(
                session_id=session_id,
                file_name=session_data.metadata.file_name,
                last_modified=now,
                row_count=session_data.metadata.row_count,
                label_count=session_data.metadata.label_count,
                rule_count=session_data.metadata.rule_count,
                storage_type=StorageType.BACKEND,
                sync_status=SyncStatus.SYNCED,
                last_synced_at=now,
                version=session_data.metadata.version or "1.0.0"
            ),
            created_at=existing.created_at if existing else now,
            updated_at=now
        )

        # Save to file
        if not save_session_to_file(persisted_state):
            raise HTTPException(status_code=500, detail="Failed to save session")

        logger.info(f"Saved session: {session_id}")

        return SessionResponse(
            success=True,
            session_id=session_id,
            timestamp=now,
            metadata=persisted_state.metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")


@router.get("/{session_id}", response_model=PersistedState)
async def get_session(session_id: str):
    """
    Get a session by ID

    - **session_id**: Unique session identifier
    """
    try:
        session = load_session_from_file(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        return session

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")


@router.delete("/{session_id}", response_model=SessionResponse)
async def delete_session(session_id: str):
    """
    Delete a session

    - **session_id**: Unique session identifier
    """
    try:
        if not delete_session_file(session_id):
            raise HTTPException(status_code=404, detail="Session not found")

        # Clear active session if it was this one
        if ACTIVE_SESSION_FILE.exists():
            with open(ACTIVE_SESSION_FILE, 'r') as f:
                active = f.read().strip()
                if active == session_id:
                    ACTIVE_SESSION_FILE.unlink()

        logger.info(f"Deleted session: {session_id}")

        return SessionResponse(
            success=True,
            session_id=session_id,
            timestamp=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")


@router.get("", response_model=List[SessionMetadata])
async def list_sessions():
    """
    List all sessions
    """
    try:
        sessions: List[SessionMetadata] = []

        for session_file in SESSIONS_DIR.glob("*.json"):
            try:
                with open(session_file, 'r') as f:
                    data = json.load(f)
                    state = PersistedState(**data)
                    sessions.append(state.metadata)
            except Exception as e:
                logger.warning(f"Failed to load session from {session_file}: {e}")
                continue

        # Sort by last modified (newest first)
        sessions.sort(key=lambda s: s.last_modified, reverse=True)

        return sessions

    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")


@router.get("/{session_id}/exists")
async def session_exists(session_id: str):
    """
    Check if a session exists

    - **session_id**: Unique session identifier
    """
    exists = get_session_file(session_id).exists()
    return JSONResponse(
        content={"exists": exists, "sessionId": session_id},
        status_code=200 if exists else 404
    )


@router.get("/active", response_model=dict)
async def get_active_session():
    """
    Get the active session ID
    """
    try:
        if not ACTIVE_SESSION_FILE.exists():
            return {"sessionId": None}

        with open(ACTIVE_SESSION_FILE, 'r') as f:
            session_id = f.read().strip()
            return {"sessionId": session_id}

    except Exception as e:
        logger.error(f"Error getting active session: {e}")
        return {"sessionId": None}


@router.post("/active", response_model=dict)
async def set_active_session(data: dict = Body(...)):
    """
    Set the active session ID

    - **sessionId**: Session ID to set as active
    """
    try:
        session_id = data.get("sessionId")
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId is required")

        with open(ACTIVE_SESSION_FILE, 'w') as f:
            f.write(session_id)

        return {"success": True, "sessionId": session_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting active session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set active session: {str(e)}")


@router.delete("", response_model=SessionResponse)
async def clear_all_sessions():
    """
    Clear all sessions (use with caution)
    """
    try:
        count = 0
        for session_file in SESSIONS_DIR.glob("*.json"):
            try:
                session_file.unlink()
                count += 1
            except Exception as e:
                logger.warning(f"Failed to delete {session_file}: {e}")

        # Clear active session
        if ACTIVE_SESSION_FILE.exists():
            ACTIVE_SESSION_FILE.unlink()

        logger.info(f"Cleared {count} sessions")

        return SessionResponse(
            success=True,
            session_id="all",
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Error clearing sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear sessions: {str(e)}")
