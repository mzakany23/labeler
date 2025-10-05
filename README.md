# Data Labeler

A modern web application for labeling personal finance datasets with drag-and-drop CSV import, intelligent labeling tools, rule-based automation, and comprehensive data quality validation.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Sample Data Format](#sample-data-format)
- [Data Quality Checks](#data-quality-checks)
- [Backend API](#backend-api)

## Overview

Data Labeler is a powerful tool for processing and analyzing financial transaction data. It provides an intuitive interface for uploading CSV files, manually labeling transactions, creating automated labeling rules, and generating comprehensive quality reports to help you understand and clean your financial datasets. With smart recommendations and rule-based automation, you can efficiently categorize large volumes of transactions while maintaining perfect data quality.

## Quick Start

### 1. Navigate to Frontend
```bash
cd services/frontend
```

### 2. Installation
```bash
npm install
```

### 3. Development Server
```bash
npm run dev
```

### 4. Access the Application
Open your browser and navigate to `http://localhost:3000`

### 5. Test with Sample Data
Use the included `sample_transactions.csv` file in the frontend directory or the conversation folder to explore the application's features.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **CSV Processing**: Papa Parse
- **File Upload**: React Dropzone
- **Icons**: Lucide React

## Key Features

### CSV Processing
- Multiple encoding support (UTF-8, Latin1, CP1252)
- Automatic data type detection
- Financial column identification
- Robust error handling
- Session persistence for work-in-progress

### Manual Labeling System
- Create and manage custom labels for transactions
- Individual row labeling with intuitive interface
- Label groups and categories for organization
- Bulk labeling operations for similar transactions
- Undo/redo functionality for labeling actions

### Rule-Based Automation
- Create powerful rules to automatically label transactions
- Multiple condition types (contains, equals, starts/ends with, regex, amount comparisons)
- Combine multiple conditions with AND/OR logic
- Preview rule matches before applying
- Apply rules to existing and future transactions

### Smart Recommendations
- AI-powered suggestions based on similar transactions
- Pattern recognition for recurring transactions
- Learn from user labeling behavior
- Confidence scoring for recommendations
- One-click application of suggestions

### Data Quality Validation
- Missing values detection with visualization
- Duplicate row identification
- Data type consistency checks
- Column statistics and uniqueness analysis
- Labeling completeness tracking

### User Interface
- Responsive design for all devices
- Intuitive drag-and-drop interface
- Paginated data preview (50 rows per page)
- Expandable column information panels
- Real-time loading states
- Keyboard shortcuts for power users

## Project Structure

```
data-labeler/
├── services/
│   ├── frontend/                      # Next.js application
│   │   ├── src/
│   │   │   ├── app/                   # Next.js App Router
│   │   │   │   ├── layout.tsx        # Root layout
│   │   │   │   ├── page.tsx          # Main application page
│   │   │   │   └── globals.css       # Global styles
│   │   │   ├── components/           # React components
│   │   │   │   ├── FileUpload.tsx    # Drag-and-drop CSV upload
│   │   │   │   ├── DataPreview.tsx   # Initial data table view
│   │   │   │   ├── LabelingDataPreview.tsx  # Labeled data view
│   │   │   │   ├── LabelManager.tsx  # Label creation/management
│   │   │   │   ├── RuleManager.tsx   # Rule creation/management
│   │   │   │   ├── RulePreviewModal.tsx  # Rule preview interface
│   │   │   │   ├── SmartRecommendations.tsx # AI suggestions
│   │   │   │   └── ValidationReport.tsx  # Data quality reports
│   │   │   ├── lib/                  # Core utilities
│   │   │   │   ├── csvProcessor.ts   # CSV parsing & validation
│   │   │   │   ├── labelingUtils.ts  # Labeling operations
│   │   │   │   ├── ruleEngine.ts     # Rule matching engine
│   │   │   │   ├── ruleUtils.ts      # Rule helpers
│   │   │   │   ├── recommendationEngine.ts  # Smart suggestions
│   │   │   │   └── statePersistence.ts  # Session management
│   │   │   └── types/                # TypeScript definitions
│   │   │       └── index.ts          # Core interfaces & types
│   │   ├── package.json              # Dependencies
│   │   ├── tsconfig.json             # TypeScript config
│   │   └── tailwind.config.js        # Tailwind CSS config
│   └── backend/                       # (Future backend services)
├── conversation/
│   └── data-labeler/
│       ├── csv/                       # Sample CSV files
│       │   └── sample_transactions.csv
│       └── markdown/
│           └── instructions.md        # Project documentation
└── README.md                          # This file
```

## Sample Data Format

The application expects CSV files with financial transaction data:

```csv
Date,Description,Amount,Balance,Category,Account
2024-01-15,"STARBUCKS STORE #1234","-4.95","1250.30","","Checking"
2024-01-15,"PAYROLL DEPOSIT COMPANY ABC","2500.00","2755.25","","Checking"
```

## Data Quality Checks

- **Missing Values**: Identifies and counts null/empty values per column
- **Data Types**: Automatic detection of numeric, date, and text columns
- **Financial Columns**: Smart detection of amount/balance columns
- **Duplicates**: Identification of exact duplicate rows
- **Completeness**: Overall data quality scoring
- **Labeling Progress**: Track percentage of labeled vs unlabeled transactions

## Backend API

A Python FastAPI backend is being developed to move the recommendation engine server-side for improved performance and scalability.

**Documentation**:
- [Backend Design Document](./BACKEND_DESIGN.md) - Complete architecture and implementation plan
- [Backend Checklist](./BACKEND_CHECKLIST.md) - Phase-by-phase implementation checklist
- [Backend README](./services/backend/README.md) - Backend setup and usage guide

**Tech Stack**:
- FastAPI for high-performance async API
- uv for modern Python dependency management
- Pydantic v2 for data validation
- OpenAPI 3.0 auto-generated documentation

**Quick Start**:
```bash
cd services/backend
uv sync
uv run uvicorn src.data_labeler_api.main:app --reload
# Visit http://localhost:8000/docs
```

**Features**:
- Multipart CSV file upload
- Recommendation generation with multiple algorithms
- CRUD operations for recommendations and labels
- File-based storage (no database required for MVP)
- Async processing for large datasets
