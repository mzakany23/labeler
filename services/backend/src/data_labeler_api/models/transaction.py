"""
Pydantic models for transaction data
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator
from datetime import datetime
from decimal import Decimal


class TransactionBase(BaseModel):
    """Base transaction model"""
    date: Optional[datetime] = Field(None, description="Transaction date")
    description: Optional[str] = Field(None, description="Transaction description")
    amount: Optional[Decimal] = Field(None, description="Transaction amount")
    balance: Optional[Decimal] = Field(None, description="Account balance after transaction")
    category: Optional[str] = Field(None, description="Transaction category")
    account: Optional[str] = Field(None, description="Account name")
    reference: Optional[str] = Field(None, description="Transaction reference number")

    @validator('amount', 'balance', pre=True)
    def parse_decimal(cls, v):
        """Parse string amounts to Decimal"""
        if isinstance(v, str):
            # Remove currency symbols and commas, handle parentheses for negative amounts
            v = v.replace('$', '').replace(',', '').strip()
            if v.startswith('(') and v.endswith(')'):
                v = f"-{v[1:-1]}"
            try:
                return Decimal(v)
            except:
                return None
        return v


class Transaction(TransactionBase):
    """Transaction with ID and metadata"""
    id: str = Field(..., description="Unique transaction identifier")
    row_number: int = Field(..., description="Original row number in CSV")
    file_id: str = Field(..., description="ID of the source file")
    label_id: Optional[str] = Field(None, description="Applied label ID")

    # Processing metadata
    is_valid: bool = Field(default=True, description="Whether transaction passed validation")
    validation_errors: List[str] = Field(default_factory=list, description="Validation error messages")
    normalized_description: Optional[str] = Field(None, description="Normalized description for matching")
    merchant_name: Optional[str] = Field(None, description="Extracted merchant name")


class TransactionCreate(BaseModel):
    """Model for creating transactions from CSV data"""
    transactions: List[TransactionBase] = Field(..., description="List of transactions to create")
    file_id: str = Field(..., description="Source file ID")


class TransactionUpdate(BaseModel):
    """Model for updating transaction data"""
    label_id: Optional[str] = Field(None, description="New label ID")
    category: Optional[str] = Field(None, description="New category")
    notes: Optional[str] = Field(None, description="User notes")


class TransactionList(BaseModel):
    """Response model for list of transactions"""
    transactions: List[Transaction] = Field(..., description="List of transactions")
    total: int = Field(..., description="Total number of transactions")
    page: int = Field(default=1, description="Current page number")
    per_page: int = Field(default=100, description="Items per page")
    file_id: str = Field(..., description="Source file ID")


class ColumnMapping(BaseModel):
    """Column mapping configuration for CSV parsing"""
    date_column: Optional[str] = Field(None, description="Column name for dates")
    description_column: Optional[str] = Field(None, description="Column name for descriptions")
    amount_column: Optional[str] = Field(None, description="Column name for amounts")
    balance_column: Optional[str] = Field(None, description="Column name for balances")
    category_column: Optional[str] = Field(None, description="Column name for categories")
    account_column: Optional[str] = Field(None, description="Column name for accounts")
    reference_column: Optional[str] = Field(None, description="Column name for references")


class FileProcessingOptions(BaseModel):
    """Options for processing uploaded files"""
    column_mapping: Optional[ColumnMapping] = Field(None, description="Custom column mapping")
    skip_validation: bool = Field(default=False, description="Skip data validation")
    normalize_text: bool = Field(default=True, description="Normalize text for better matching")
    extract_merchants: bool = Field(default=True, description="Extract merchant names from descriptions")


class ProcessedFile(BaseModel):
    """Result of file processing"""
    file_id: str = Field(..., description="File identifier")
    filename: str = Field(..., description="Original filename")
    total_rows: int = Field(..., description="Total number of rows processed")
    valid_transactions: int = Field(..., description="Number of valid transactions")
    invalid_rows: int = Field(..., description="Number of invalid rows")
    columns_detected: Dict[str, str] = Field(..., description="Detected column types")
    processing_time_seconds: float = Field(..., description="Processing time in seconds")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Processing timestamp")
