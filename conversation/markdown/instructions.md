# Data Labeler Project Instructions

This document outlines the development phases and work breakdown for the Data Labeler application.

## Current Phase: Phase 1 - Foundation & Core Features ✓

### Completed Tasks
- ✓ Project structure setup (Frontend + Backend)
- ✓ CSV processing and validation
- ✓ Manual labeling interface
- ✓ Basic data preview functionality
- ✓ File upload system
- ✓ Session persistence

## Phase 2 - Enhanced Labeling & Rules Engine (In Progress)

### Current Sprint Focus
- **Rule-based Automation**: Create intelligent rules to automatically label transactions
- **Smart Recommendations**: AI-powered suggestions based on transaction patterns
- **Data Quality Validation**: Comprehensive validation reports and quality checks

### Tasks for This Phase

#### 2.1 Rule Engine Enhancement
- [ ] Implement advanced rule conditions (regex, amount ranges, date patterns)
- [ ] Add rule preview functionality before applying
- [ ] Create rule management interface with edit/delete capabilities
- [ ] Add rule priority and ordering system
- [ ] Implement rule validation and conflict detection

#### 2.2 Smart Recommendations
- [ ] Enhance pattern recognition algorithms
- [ ] Add confidence scoring for recommendations
- [ ] Implement learning from user labeling behavior
- [ ] Add bulk recommendation application
- [ ] Create recommendation performance tracking

#### 2.3 Data Quality & Validation
- [ ] Expand data quality checks (outliers, format validation)
- [ ] Add data profiling capabilities
- [ ] Implement automated data cleaning suggestions
- [ ] Create comprehensive validation reports
- [ ] Add data quality scoring metrics

#### 2.4 User Experience Improvements
- [ ] Add keyboard shortcuts for power users
- [ ] Implement drag-and-drop for rule management
- [ ] Add bulk operations for labeling
- [ ] Create advanced filtering and search
- [ ] Add export capabilities for labeled data

## Phase 3 - Advanced Features & Backend Services

### Planned Features
- **Backend API**: Move recommendation engine server-side
- **Real-time Collaboration**: Multi-user labeling sessions
- **Advanced Analytics**: Spending patterns and insights
- **Integration APIs**: Connect with financial institutions
- **ML Model Training**: Custom models for better recommendations

## Phase 4 - Production & Scale

### Production Readiness
- **Performance Optimization**: Handle large datasets efficiently
- **Error Monitoring**: Comprehensive logging and alerting
- **Security**: Data encryption and access controls
- **Backup & Recovery**: Data persistence and recovery
- **API Rate Limiting**: Prevent abuse and ensure fair usage

## Development Guidelines

### Code Organization
- Keep components modular and reusable
- Follow TypeScript best practices
- Implement proper error handling
- Add comprehensive tests
- Document APIs and complex logic

### User Experience
- Maintain intuitive drag-and-drop interface
- Provide clear feedback for all operations
- Implement progressive loading for large datasets
- Add helpful tooltips and documentation
- Ensure responsive design for all devices

### Data Handling
- Validate all CSV formats and encodings
- Handle edge cases in financial data
- Provide clear error messages for data issues
- Implement data backup before major operations
- Support multiple file formats for import/export

## Getting Started

1. **Setup Development Environment**
   ```bash
   cd services/frontend
   npm install
   npm run dev
   ```

2. **Test with Sample Data**
   - Use `sample_transactions.csv` in the frontend directory
   - Explore all features: upload, label, create rules, view reports

3. **Backend Development**
   ```bash
   cd services/backend
   uv sync
   uv run uvicorn src.data_labeler_api.main:app --reload
   ```

## Next Steps

Focus on completing Phase 2 features, particularly:
- Rule engine with preview functionality
- Enhanced recommendation algorithms
- Comprehensive data validation
- Improved user experience with keyboard shortcuts

Each completed feature should be thoroughly tested and documented before moving to the next phase.
