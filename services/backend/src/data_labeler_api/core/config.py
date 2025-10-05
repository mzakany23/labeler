"""
Configuration management for Data Labeler API
"""

import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Application
    app_name: str = Field(default="Data Labeler API")
    app_version: str = Field(default="1.0.0")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")

    # Server
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    workers: int = Field(default=1)

    # CORS
    allowed_origins_str: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        description="Comma-separated list of allowed origins"
    )

    @property
    def allowed_origins(self) -> List[str]:
        """Parse comma-separated origins string into list"""
        if not self.allowed_origins_str:
            return []
        return [origin.strip() for origin in self.allowed_origins_str.split(",")]

    # Storage
    data_dir: Path = Field(default=Path("./data"))
    max_upload_size_mb: int = Field(default=10)
    file_retention_hours: int = Field(default=24)

    # Recommendations
    min_confidence: float = Field(default=0.6, ge=0.0, le=1.0)
    max_recommendations_per_row: int = Field(default=3, gt=0)
    exact_match_weight: float = Field(default=1.0, ge=0.0, le=1.0)
    fuzzy_match_weight: float = Field(default=0.8, ge=0.0, le=1.0)
    merchant_pattern_weight: float = Field(default=0.7, ge=0.0, le=1.0)
    amount_pattern_weight: float = Field(default=0.6, ge=0.0, le=1.0)

    # Processing
    max_concurrent_uploads: int = Field(default=5, gt=0)
    request_timeout_seconds: int = Field(default=30, gt=0)

    class Config:
        """Pydantic configuration"""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

        # Allow extra fields in environment
        extra = "ignore"


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings"""
    return settings


def ensure_data_directories():
    """Create data directories if they don't exist"""
    directories = [
        settings.data_dir / "uploads",
        settings.data_dir / "processed",
        settings.data_dir / "recommendations",
    ]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


def get_upload_size_limit() -> int:
    """Get maximum upload size in bytes"""
    return settings.max_upload_size_mb * 1024 * 1024


def get_file_retention_seconds() -> int:
    """Get file retention time in seconds"""
    return settings.file_retention_hours * 3600