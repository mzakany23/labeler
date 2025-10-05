# Data Labeler API

FastAPI backend for the financial transaction recommendation engine.

## Overview

This backend service provides intelligent label recommendations for financial transactions using multiple algorithms:
- **Exact Match**: Merchant + amount matching
- **Fuzzy Match**: Similarity-based recommendations
- **Merchant Patterns**: Regex-based category detection
- **Amount Patterns**: Recurring transaction analysis

## Quick Start

### Prerequisites
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) package manager

### Installation

```bash
# Navigate to backend directory
cd services/backend

# Create virtual environment and install dependencies
uv sync

# Install dev dependencies
uv sync --extra dev
```

### Development Server

```bash
# Run with hot reload
uv run uvicorn src.data_labeler_api.main:app --reload --port 8000

# Or run directly
uv run python -m src.data_labeler_api.main
```

### Access API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Project Structure

```
backend/
├── src/
│   └── data_labeler_api/
│       ├── __init__.py
│       ├── main.py              # FastAPI app entry point
│       ├── api/                 # API endpoints
│       │   ├── files.py         # File upload/management
│       │   ├── recommendations.py
│       │   └── health.py
│       ├── core/                # Core utilities
│       │   ├── config.py
│       │   └── storage.py
│       ├── models/              # Pydantic models
│       │   ├── transaction.py
│       │   └── recommendation.py
│       ├── services/            # Business logic
│       │   ├── recommendation_engine.py
│       │   ├── csv_processor.py
│       │   └── similarity_engine.py
│       └── utils/               # Helper functions
├── tests/                       # Test suite
├── data/                        # Local file storage (gitignored)
│   ├── uploads/
│   ├── processed/
│   └── recommendations/
├── pyproject.toml
└── README.md
```

## Development

### Running Tests

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=src --cov-report=html

# Run specific test file
uv run pytest tests/test_recommendations.py
```

### Code Quality

```bash
# Format code
uv run ruff format .

# Lint code
uv run ruff check .

# Type checking
uv run mypy src
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
uv run pre-commit install

# Run manually
uv run pre-commit run --all-files
```

## API Endpoints

### Health Check
```http
GET /health
```

### File Management
```http
POST   /api/v1/files/upload
GET    /api/v1/files
GET    /api/v1/files/{file_id}
DELETE /api/v1/files/{file_id}
```

### Recommendations
```http
POST   /api/v1/recommendations/generate
GET    /api/v1/recommendations
GET    /api/v1/recommendations/{id}
PATCH  /api/v1/recommendations/{id}/rows/{row_id}
DELETE /api/v1/recommendations/{id}
```

## Configuration

Create a `.env` file in the backend directory:

```env
# Application
APP_NAME="Data Labeler API"
APP_VERSION="1.0.0"
DEBUG=true

# Server
HOST=0.0.0.0
PORT=8000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Storage
DATA_DIR=./data
MAX_UPLOAD_SIZE_MB=10

# Recommendations
MIN_CONFIDENCE=0.6
MAX_RECOMMENDATIONS_PER_ROW=3
```

## Docker

```bash
# Build image
docker build -t data-labeler-api .

# Run container
docker run -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  -e DEBUG=true \
  data-labeler-api

# Using docker-compose
docker-compose up -d
```

## Testing with Sample Data

```bash
# Upload sample CSV
curl -X POST "http://localhost:8000/api/v1/files/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@../../conversation/data-labeler/csv/sample_transactions.csv"

# Generate recommendations
curl -X POST "http://localhost:8000/api/v1/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/recommendation_request.json
```

## Performance

- Handles 1000+ row datasets in <2 seconds
- Supports concurrent file uploads
- Async processing for large files
- Efficient pandas-based CSV parsing

## Architecture

See [BACKEND_DESIGN.md](../../BACKEND_DESIGN.md) for complete architecture and implementation details.

## Troubleshooting

### Common Issues

**Import errors**: Make sure you're using `uv run` before commands
```bash
uv run python script.py
```

**Port already in use**: Change the port
```bash
uv run uvicorn src.data_labeler_api.main:app --port 8001
```

**File upload fails**: Check data directory permissions
```bash
mkdir -p data/{uploads,processed,recommendations}
chmod 755 data
```

## Contributing

1. Create feature branch
2. Make changes with tests
3. Run linting: `uv run ruff check .`
4. Run tests: `uv run pytest`
5. Submit pull request

## License

See main project LICENSE file.
