"""
File storage management for Data Labeler API
"""

import os
import uuid
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging

from .config import get_settings, ensure_data_directories

logger = logging.getLogger(__name__)
settings = get_settings()


class FileStorageManager:
    """Manages file storage operations for the Data Labeler API"""

    def __init__(self):
        """Initialize storage manager"""
        ensure_data_directories()
        self.uploads_dir = settings.data_dir / "uploads"
        self.processed_dir = settings.data_dir / "processed"
        self.recommendations_dir = settings.data_dir / "recommendations"

        # In-memory file registry for tracking
        self._file_registry: Dict[str, Dict[str, Any]] = {}

    def generate_file_id(self) -> str:
        """Generate a unique file ID"""
        return str(uuid.uuid4())

    def generate_session_id(self) -> str:
        """Generate a unique session ID"""
        return f"session_{uuid.uuid4()}"

    def save_uploaded_file(self, file_path: Path, original_filename: str,
                          session_id: Optional[str] = None) -> str:
        """
        Save an uploaded file and register it

        Args:
            file_path: Path to the uploaded file
            original_filename: Original filename
            session_id: Optional session ID

        Returns:
            file_id: Unique file identifier
        """
        file_id = self.generate_file_id()

        # Create session if not provided
        if session_id is None:
            session_id = self.generate_session_id()

        # Ensure session directory exists
        session_dir = self.uploads_dir / session_id
        session_dir.mkdir(exist_ok=True)

        # Move file to session directory
        dest_path = session_dir / f"{file_id}_{original_filename}"
        shutil.move(str(file_path), str(dest_path))

        # Register file
        file_info = {
            "file_id": file_id,
            "original_filename": original_filename,
            "stored_path": str(dest_path),
            "session_id": session_id,
            "uploaded_at": datetime.utcnow().isoformat(),
            "file_size": dest_path.stat().st_size,
        }

        self._file_registry[file_id] = file_info

        logger.info(f"Saved uploaded file: {file_id} ({original_filename})")
        return file_id

    def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file information by ID"""
        return self._file_registry.get(file_id)

    def get_file_path(self, file_id: str) -> Optional[Path]:
        """Get file path by ID"""
        file_info = self.get_file_info(file_id)
        if file_info:
            return Path(file_info["stored_path"])
        return None

    def list_files(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all files, optionally filtered by session"""
        files = []
        for file_info in self._file_registry.values():
            if session_id is None or file_info["session_id"] == session_id:
                files.append(file_info.copy())
        return files

    def delete_file(self, file_id: str) -> bool:
        """Delete a file and its associated data"""
        file_info = self._file_registry.get(file_id)
        if not file_info:
            return False

        # Delete uploaded file
        file_path = Path(file_info["stored_path"])
        if file_path.exists():
            file_path.unlink()

        # Delete processed data if exists
        processed_path = self.processed_dir / f"{file_id}.json"
        if processed_path.exists():
            processed_path.unlink()

        # Delete recommendations if exist
        rec_pattern = f"{file_id}_*.json"
        for rec_file in self.recommendations_dir.glob(rec_pattern):
            rec_file.unlink()

        # Remove from registry
        del self._file_registry[file_id]

        logger.info(f"Deleted file: {file_id}")
        return True

    def save_processed_data(self, file_id: str, data: Dict[str, Any]) -> bool:
        """Save processed transaction data"""
        try:
            output_path = self.processed_dir / f"{file_id}.json"
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            # Update file info
            if file_id in self._file_registry:
                self._file_registry[file_id]["processed_at"] = datetime.utcnow().isoformat()
                self._file_registry[file_id]["processed_path"] = str(output_path)

            logger.info(f"Saved processed data for file: {file_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save processed data for {file_id}: {e}")
            return False

    def get_processed_data(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get processed transaction data"""
        processed_path = self.processed_dir / f"{file_id}.json"
        if not processed_path.exists():
            return None

        try:
            with open(processed_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load processed data for {file_id}: {e}")
            return None

    def save_recommendations(self, file_id: str, recommendations: Dict[str, Any]) -> str:
        """Save recommendation results"""
        recommendation_id = f"{file_id}_{uuid.uuid4()}"

        try:
            output_path = self.recommendations_dir / f"{recommendation_id}.json"
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(recommendations, f, indent=2, ensure_ascii=False)

            # Update file info
            if file_id in self._file_registry:
                if "recommendations" not in self._file_registry[file_id]:
                    self._file_registry[file_id]["recommendations"] = []
                self._file_registry[file_id]["recommendations"].append({
                    "id": recommendation_id,
                    "generated_at": datetime.utcnow().isoformat(),
                    "path": str(output_path)
                })

            logger.info(f"Saved recommendations for file: {file_id} (ID: {recommendation_id})")
            return recommendation_id
        except Exception as e:
            logger.error(f"Failed to save recommendations for {file_id}: {e}")
            raise

    def get_recommendations(self, recommendation_id: str) -> Optional[Dict[str, Any]]:
        """Get recommendation results by ID"""
        rec_path = self.recommendations_dir / f"{recommendation_id}.json"
        if not rec_path.exists():
            return None

        try:
            with open(rec_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load recommendations {recommendation_id}: {e}")
            return None

    def list_recommendations(self, file_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List recommendations, optionally filtered by file"""
        recommendations = []

        if file_id and file_id in self._file_registry:
            file_info = self._file_registry[file_id]
            return file_info.get("recommendations", [])

        # Return all recommendations across all files
        for file_info in self._file_registry.values():
            recs = file_info.get("recommendations", [])
            recommendations.extend(recs)

        return recommendations

    def cleanup_old_files(self) -> int:
        """Clean up files older than retention period"""
        cutoff_time = datetime.utcnow() - timedelta(hours=settings.file_retention_hours)
        deleted_count = 0

        for file_id, file_info in list(self._file_registry.items()):
            uploaded_at = datetime.fromisoformat(file_info["uploaded_at"])

            if uploaded_at < cutoff_time:
                self.delete_file(file_id)
                deleted_count += 1

        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old files")
        return deleted_count

    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage usage statistics"""
        total_files = len(self._file_registry)
        total_size = sum(
            file_info.get("file_size", 0)
            for file_info in self._file_registry.values()
        )

        # Count recommendations
        total_recommendations = sum(
            len(file_info.get("recommendations", []))
            for file_info in self._file_registry.values()
        )

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_recommendations": total_recommendations,
            "data_directory": str(settings.data_dir),
            "uploads_directory": str(self.uploads_dir),
            "processed_directory": str(self.processed_dir),
            "recommendations_directory": str(self.recommendations_dir)
        }


# Global storage manager instance
storage_manager = FileStorageManager()