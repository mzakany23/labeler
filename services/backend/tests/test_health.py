"""
Test suite for health check endpoint
"""

import pytest
from fastapi.testclient import TestClient
from data_labeler_api.main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint returns 200 OK"""
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert "timestamp" in data


def test_root_endpoint():
    """Test root endpoint returns API information"""
    response = client.get("/")

    assert response.status_code == 200
    data = response.json()

    assert data["message"] == "Data Labeler API"
    assert data["version"] == "1.0.0"
    assert data["documentation"] == "/docs"
    assert data["health"] == "/health"


def test_openapi_docs_available():
    """Test that OpenAPI documentation is accessible"""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    openapi_schema = response.json()

    assert openapi_schema["info"]["title"] == "Data Labeler API"
    assert openapi_schema["info"]["version"] == "1.0.0"
