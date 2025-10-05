"""
CSV processing service for financial transaction data
"""

import csv
import io
import chardet
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime
from decimal import Decimal, InvalidOperation
import logging
import re

import pandas as pd
import numpy as np

from ..models.transaction import (
    Transaction,
    TransactionBase,
    ColumnMapping,
    FileProcessingOptions,
    ProcessedFile
)
from ..models.file import ValidationError, ValidationReport

logger = logging.getLogger(__name__)


class CSVProcessor:
    """Service for processing CSV files with financial transaction data"""

    # Common encodings to try for CSV files
    ENCODINGS = ['utf-8', 'latin1', 'cp1252', 'iso-8859-1']

    # Common financial column names (case-insensitive patterns)
    COLUMN_PATTERNS = {
        'date': [
            r'date', r'transaction.date', r'txn.date', r'posted.date',
            r'value.date', r'trade.date', r'settle.date'
        ],
        'description': [
            r'description', r'desc', r'memo', r'reference', r'details',
            r'transaction.description', r'txn.desc', r'narration'
        ],
        'amount': [
            r'amount', r'value', r'total', r'sum', r'payment',
            r'debit', r'credit', r'withdrawal', r'deposit',
            r'transaction.amount', r'txn.amount'
        ],
        'balance': [
            r'balance', r'running.balance', r'account.balance',
            r'ending.balance', r'current.balance'
        ],
        'category': [
            r'category', r'type', r'class', r'classification',
            r'transaction.type', r'txn.type'
        ],
        'account': [
            r'account', r'account.name', r'account.number',
            r'bank.account', r'checking.account'
        ],
        'reference': [
            r'reference', r'ref', r'ref.number', r'transaction.id',
            r'check.number', r'confirmation.number'
        ]
    }

    def __init__(self):
        """Initialize CSV processor"""
        pass

    def detect_encoding(self, file_path: str) -> str:
        """
        Detect file encoding using chardet

        Args:
            file_path: Path to the file

        Returns:
            Detected encoding
        """
        with open(file_path, 'rb') as f:
            raw_data = f.read(10000)  # Read first 10KB for detection

        result = chardet.detect(raw_data)
        encoding = result.get('encoding', 'utf-8')

        logger.info(f"Detected encoding for {file_path}: {encoding} (confidence: {result.get('confidence', 0):.2f})")
        return encoding

    def read_csv_with_encoding(self, file_path: str, encoding: Optional[str] = None) -> pd.DataFrame:
        """
        Read CSV file with automatic encoding detection

        Args:
            file_path: Path to CSV file
            encoding: Optional encoding override

        Returns:
            Pandas DataFrame with CSV data
        """
        if encoding:
            encodings_to_try = [encoding]
        else:
            encodings_to_try = self.ENCODINGS

        last_error = None

        for enc in encodings_to_try:
            try:
                df = pd.read_csv(
                    file_path,
                    encoding=enc,
                    low_memory=False,
                    on_bad_lines='skip'  # Skip malformed lines
                )
                logger.info(f"Successfully read {file_path} with encoding: {enc}")
                return df

            except UnicodeDecodeError as e:
                last_error = e
                logger.warning(f"Failed to read {file_path} with encoding {enc}: {e}")
                continue
            except Exception as e:
                last_error = e
                logger.warning(f"Error reading {file_path} with encoding {enc}: {e}")
                continue

        # If all encodings failed, try with error handling
        try:
            df = pd.read_csv(
                file_path,
                encoding='utf-8',
                errors='replace',  # Replace invalid characters
                low_memory=False
            )
            logger.warning(f"Read {file_path} with error replacement")
            return df
        except Exception as e:
            logger.error(f"Failed to read {file_path} with all encodings: {last_error}")
            raise Exception(f"Could not read CSV file {file_path}: {last_error}")

    def detect_column_types(self, df: pd.DataFrame) -> Dict[str, str]:
        """
        Detect column data types

        Args:
            df: Pandas DataFrame

        Returns:
            Dictionary mapping column names to detected types
        """
        column_types = {}

        for column in df.columns:
            # Get sample of non-null values
            sample = df[column].dropna().head(100)

            if len(sample) == 0:
                column_types[column] = 'unknown'
                continue

            # Check for date patterns
            if self._is_date_column(sample):
                column_types[column] = 'date'
            # Check for numeric patterns
            elif self._is_numeric_column(sample):
                column_types[column] = 'numeric'
            # Check for text patterns
            elif self._is_text_column(sample):
                column_types[column] = 'text'
            else:
                column_types[column] = 'mixed'

        return column_types

    def _is_date_column(self, series: pd.Series) -> bool:
        """Check if series contains date values"""
        if len(series) == 0:
            return False

        # Try to parse as dates
        try:
            pd.to_datetime(series.head(10), infer_datetime_format=True)
            return True
        except:
            return False

    def _is_numeric_column(self, series: pd.Series) -> bool:
        """Check if series contains numeric values"""
        if len(series) == 0:
            return False

        # Check if values can be converted to numeric
        try:
            pd.to_numeric(series.head(10))
            return True
        except:
            return False

    def _is_text_column(self, series: pd.Series) -> bool:
        """Check if series contains text values"""
        if len(series) == 0:
            return False

        # If not date or numeric, likely text
        return not (self._is_date_column(series) or self._is_numeric_column(series))

    def identify_financial_columns(self, df: pd.DataFrame) -> ColumnMapping:
        """
        Identify financial columns using pattern matching

        Args:
            df: Pandas DataFrame

        Returns:
            ColumnMapping with identified columns
        """
        column_names = {col.lower().strip() for col in df.columns}
        mapping = ColumnMapping()

        # Match column patterns
        for col in df.columns:
            col_lower = col.lower().strip()

            for field, patterns in self.COLUMN_PATTERNS.items():
                for pattern in patterns:
                    if re.search(pattern, col_lower, re.IGNORECASE):
                        setattr(mapping, f"{field}_column", col)
                        break

        return mapping

    def validate_csv_structure(self, df: pd.DataFrame, mapping: ColumnMapping) -> ValidationReport:
        """
        Validate CSV structure and data quality

        Args:
            df: Pandas DataFrame
            mapping: Column mapping configuration

        Returns:
            ValidationReport with results
        """
        errors = []
        warnings = []
        column_info = {}

        total_rows = len(df)

        # Check for required columns
        required_columns = ['description_column', 'amount_column']
        for req_col in required_columns:
            col_name = getattr(mapping, req_col, None)
            if not col_name or col_name not in df.columns:
                errors.append(ValidationError(
                    row=0,
                    column=None,
                    value=None,
                    error_type="missing_column",
                    message=f"Required column '{req_col}' not found or not mapped"
                ))

        # Validate each column
        for col in df.columns:
            col_info = self._validate_column(df[col], col)
            column_info[col] = col_info

            # Add warnings for low data quality
            if col_info['null_percentage'] > 50:
                warnings.append(f"Column '{col}' has {col_info['null_percentage']:.1f}% missing values")

            if col_info['duplicate_percentage'] > 30:
                warnings.append(f"Column '{col}' has {col_info['duplicate_percentage']:.1f}% duplicate values")

        # Check for minimum row count
        if total_rows < 2:
            errors.append(ValidationError(
                row=0,
                column=None,
                value=total_rows,
                error_type="insufficient_data",
                message="CSV must contain at least 2 rows (header + data)"
            ))

        # Validate date column if present
        if mapping.date_column and mapping.date_column in df.columns:
            date_validation = self._validate_date_column(df[mapping.date_column])
            if not date_validation['is_valid']:
                errors.extend(date_validation['errors'])

        return ValidationReport(
            is_valid=len(errors) == 0,
            total_rows=total_rows,
            valid_rows=max(0, total_rows - len(errors)),
            invalid_rows=len(errors),
            errors=errors,
            warnings=warnings,
            column_info=column_info
        )

    def _validate_column(self, series: pd.Series, column_name: str) -> Dict[str, Any]:
        """Validate a single column"""
        total_values = len(series)
        null_count = series.isnull().sum()
        duplicate_count = series.duplicated().sum()

        return {
            'total_values': total_values,
            'null_count': int(null_count),
            'null_percentage': (null_count / total_values * 100) if total_values > 0 else 0,
            'duplicate_count': int(duplicate_count),
            'duplicate_percentage': (duplicate_count / total_values * 100) if total_values > 0 else 0,
            'unique_values': series.nunique(),
            'data_type': str(series.dtype)
        }

    def _validate_date_column(self, series: pd.Series) -> Dict[str, Any]:
        """Validate date column specifically"""
        errors = []
        valid_dates = 0

        for i, value in enumerate(series):
            if pd.isnull(value):
                continue

            try:
                # Try to parse as date
                pd.to_datetime(value)
                valid_dates += 1
            except:
                errors.append(ValidationError(
                    row=i + 2,  # +2 because row numbers are 1-based and we skip header
                    column=None,
                    value=str(value),
                    error_type="invalid_date",
                    message=f"Could not parse date: {value}"
                ))

        return {
            'is_valid': len(errors) == 0,
            'valid_dates': valid_dates,
            'errors': errors
        }

    def process_csv_file(
        self,
        file_path: str,
        file_id: str,
        options: Optional[FileProcessingOptions] = None
    ) -> Tuple[ProcessedFile, List[Transaction], ValidationReport]:
        """
        Process a CSV file and convert to transaction objects

        Args:
            file_path: Path to CSV file
            file_id: Unique file identifier
            options: Processing options

        Returns:
            Tuple of (processed_file, transactions, validation_report)
        """
        import time
        start_time = time.time()

        # Set default options
        if options is None:
            options = FileProcessingOptions()

        # Detect encoding and read file
        encoding = self.detect_encoding(file_path)
        df = self.read_csv_with_encoding(file_path, encoding)

        # Detect column types
        column_types = self.detect_column_types(df)

        # Identify financial columns
        column_mapping = self.identify_financial_columns(df)

        # Override with user-provided mapping if available
        if options.column_mapping:
            column_mapping = options.column_mapping

        # Validate structure
        validation_report = self.validate_csv_structure(df, column_mapping)

        # Convert to transactions
        transactions = self._convert_to_transactions(df, column_mapping, file_id, options)

        processing_time = time.time() - start_time

        processed_file = ProcessedFile(
            file_id=file_id,
            filename=file_path.split('/')[-1],
            total_rows=len(df),
            valid_transactions=len([t for t in transactions if t.is_valid]),
            invalid_rows=len([t for t in transactions if not t.is_valid]),
            columns_detected=column_types,
            processing_time_seconds=processing_time
        )

        return processed_file, transactions, validation_report

    def _convert_to_transactions(
        self,
        df: pd.DataFrame,
        mapping: ColumnMapping,
        file_id: str,
        options: FileProcessingOptions
    ) -> List[Transaction]:
        """Convert DataFrame rows to Transaction objects"""
        transactions = []

        for row_idx, (_, row) in enumerate(df.iterrows()):
            try:
                # Extract data using column mapping
                transaction_data = self._extract_transaction_data(row, mapping, row_idx + 2)  # +2 for 1-based row numbers

                # Create transaction object
                transaction = Transaction(
                    id=f"{file_id}_row_{row_idx + 2}",
                    row_number=row_idx + 2,
                    file_id=file_id,
                    **transaction_data
                )

                # Apply text normalization if enabled
                if options.normalize_text and transaction.description:
                    transaction.normalized_description = self._normalize_text(transaction.description)

                # Extract merchant name if enabled
                if options.extract_merchants and transaction.description:
                    transaction.merchant_name = self._extract_merchant_name(transaction.description)

                transactions.append(transaction)

            except Exception as e:
                logger.error(f"Error processing row {row_idx + 2}: {e}")
                # Create invalid transaction
                transactions.append(Transaction(
                    id=f"{file_id}_row_{row_idx + 2}",
                    row_number=row_idx + 2,
                    file_id=file_id,
                    is_valid=False,
                    validation_errors=[str(e)]
                ))

        return transactions

    def _extract_transaction_data(self, row: pd.Series, mapping: ColumnMapping, row_number: int) -> Dict[str, Any]:
        """Extract transaction data from a DataFrame row"""
        data = {}

        # Extract date
        if mapping.date_column and mapping.date_column in row:
            try:
                data['date'] = pd.to_datetime(row[mapping.date_column]).to_pydantic()
            except:
                data['date'] = None

        # Extract description
        if mapping.description_column and mapping.description_column in row:
            data['description'] = str(row[mapping.description_column]).strip()

        # Extract amount
        if mapping.amount_column and mapping.amount_column in row:
            try:
                amount_str = str(row[mapping.amount_column]).strip()
                # Handle parentheses for negative amounts
                if amount_str.startswith('(') and amount_str.endswith(')'):
                    amount_str = f"-{amount_str[1:-1]}"
                data['amount'] = Decimal(amount_str)
            except (InvalidOperation, ValueError):
                data['amount'] = None

        # Extract balance
        if mapping.balance_column and mapping.balance_column in row:
            try:
                data['balance'] = Decimal(str(row[mapping.balance_column]).strip())
            except (InvalidOperation, ValueError):
                data['balance'] = None

        # Extract category
        if mapping.category_column and mapping.category_column in row:
            data['category'] = str(row[mapping.category_column]).strip()

        # Extract account
        if mapping.account_column and mapping.account_column in row:
            data['account'] = str(row[mapping.account_column]).strip()

        # Extract reference
        if mapping.reference_column and mapping.reference_column in row:
            data['reference'] = str(row[mapping.reference_column]).strip()

        return data

    def _normalize_text(self, text: str) -> str:
        """Normalize text for better matching"""
        if not text:
            return ""

        # Convert to lowercase
        normalized = text.lower()

        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        # Remove special characters but keep letters, numbers, and spaces
        normalized = re.sub(r'[^\w\s]', '', normalized)

        # Common text normalizations for financial transactions
        replacements = [
            (r'\bstores?\b', 'store'),
            (r'\bmarket\b', 'market'),
            (r'\bgrocery\b', 'grocery'),
            (r'\bgas\b', 'gas'),
            (r'\brestaurant\b', 'restaurant'),
            (r'\bpharmacy\b', 'pharmacy'),
            (r'\batm\b', 'atm'),
            (r'\bonline\b', 'online'),
            (r'\bpayment\b', 'payment'),
            (r'\btransfer\b', 'transfer'),
        ]

        for pattern, replacement in replacements:
            normalized = re.sub(pattern, replacement, normalized)

        return normalized

    def _extract_merchant_name(self, description: str) -> Optional[str]:
        """Extract merchant name from transaction description"""
        if not description:
            return None

        # Common patterns for merchant extraction
        patterns = [
            r'^([^#]+)#?\d*',  # "STARBUCKS #1234" -> "STARBUCKS"
            r'^([A-Z\s]+)\s+\d+',  # "MCDONALDS 123 MAIN ST" -> "MCDONALDS"
            r'^([^0-9]+)\s*\d*$',  # "AMAZON 123" -> "AMAZON"
        ]

        for pattern in patterns:
            match = re.match(pattern, description.strip())
            if match:
                merchant = match.group(1).strip()
                # Filter out very short or generic terms
                if len(merchant) > 2 and merchant.lower() not in ['the', 'and', 'for', 'with']:
                    return merchant

        return None

    def export_to_csv(self, transactions: List[Transaction], output_path: str) -> bool:
        """Export transactions back to CSV format"""
        try:
            # Convert transactions to DataFrame
            data = []
            for transaction in transactions:
                row = {
                    'date': transaction.date.isoformat() if transaction.date else '',
                    'description': transaction.description or '',
                    'amount': str(transaction.amount) if transaction.amount else '',
                    'balance': str(transaction.balance) if transaction.balance else '',
                    'category': transaction.category or '',
                    'account': transaction.account or '',
                    'reference': transaction.reference or '',
                    'label_id': transaction.label_id or '',
                }
                data.append(row)

            df = pd.DataFrame(data)

            # Write to CSV
            df.to_csv(output_path, index=False)
            logger.info(f"Exported {len(transactions)} transactions to {output_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to export transactions to CSV: {e}")
            return False
