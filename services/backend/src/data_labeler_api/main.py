"""
FastAPI Application Entry Point
Financial Transaction Recommendation Engine
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime
import logging

from .core.config import get_settings, ensure_data_directories
from .core.storage import storage_manager
from .api.files import router as files_router
from .api.rules import router as rules_router
from .api.recommendations import router as recommendations_router
from .api.merchant_patterns import router as merchant_patterns_router
from .api.configuration import router as configuration_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info("API documentation available at /docs")

    # Ensure data directories exist
    ensure_data_directories()

    # Cleanup old files on startup
    deleted_count = storage_manager.cleanup_old_files()
    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} old files on startup")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.app_name}")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="Financial transaction recommendation engine with ML-powered labeling",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Register API routers
app.include_router(files_router, prefix="/api/v1")
app.include_router(rules_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(merchant_patterns_router, prefix="/api/v1")
app.include_router(configuration_router, prefix="/api/v1")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify the API is running.

    Returns:
        JSON response with status, version, and timestamp
    """
    return JSONResponse(
        content={
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        },
        status_code=200
    )


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint with API information.
    """
    return {
        "message": "Data Labeler API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health"
    }


# Add storage manager to app state for access in endpoints
app.state.storage = storage_manager


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "data_labeler_api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=settings.workers,
        log_level=settings.log_level.lower()
    )
