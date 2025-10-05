#!/bin/bash
# Quickstart script for Data Labeler API backend

set -e

echo "🚀 Data Labeler API - Quickstart"
echo "================================"
echo ""

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed"
    echo "📦 Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "✓ uv detected"
echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/uploads data/processed data/recommendations
echo "✓ Data directories created"
echo ""

# Sync dependencies
echo "📦 Installing dependencies..."
uv sync
echo "✓ Dependencies installed"
echo ""

# Install dev dependencies (optional)
read -p "Install dev dependencies (pytest, ruff, mypy)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Installing dev dependencies..."
    uv sync --extra dev
    echo "✓ Dev dependencies installed"
fi
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Application Configuration
APP_NAME="Data Labeler API"
APP_VERSION="1.0.0"
DEBUG=true
LOG_LEVEL=INFO

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=1

# CORS - Add your frontend URLs
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Storage
DATA_DIR=./data
MAX_UPLOAD_SIZE_MB=10
FILE_RETENTION_HOURS=24

# Recommendations
MIN_CONFIDENCE=0.6
MAX_RECOMMENDATIONS_PER_ROW=3
EXACT_MATCH_WEIGHT=1.0
FUZZY_MATCH_WEIGHT=0.8
MERCHANT_PATTERN_WEIGHT=0.7
AMOUNT_PATTERN_WEIGHT=0.6

# Processing
MAX_CONCURRENT_UPLOADS=5
REQUEST_TIMEOUT_SECONDS=30
EOF
    echo "✓ .env file created"
else
    echo "✓ .env file already exists"
fi
echo ""

# Run tests
read -p "Run tests? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Running tests..."
    uv run pytest
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "To start the development server:"
echo "  uv run uvicorn src.data_labeler_api.main:app --reload"
echo ""
echo "Then visit:"
echo "  📚 API Docs: http://localhost:8000/docs"
echo "  📖 ReDoc: http://localhost:8000/redoc"
echo "  ❤️  Health: http://localhost:8000/health"
echo ""
