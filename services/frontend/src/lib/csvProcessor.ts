import Papa from 'papaparse';
import { TransactionData, ValidationReport } from '@/types';
import { assignRowIds } from './labelingUtils';

export function validateCsvData(data: TransactionData[]): ValidationReport {
  const report: ValidationReport = {
    totalRows: data.length,
    totalColumns: data.length > 0 ? Object.keys(data[0]).length : 0,
    missingValues: {},
    duplicateRows: 0,
    dataTypes: {},
    numericColumns: [],
    dateColumns: [],
    issues: []
  };

  if (data.length === 0) {
    report.issues.push('No data rows found');
    return report;
  }

  const columns = Object.keys(data[0]);

  // Initialize missing values count
  columns.forEach(col => {
    report.missingValues[col] = 0;
  });

  // Analyze each column
  columns.forEach(col => {
    let numericCount = 0;
    let dateCount = 0;
    let totalNonNull = 0;

    data.forEach(row => {
      const value = row[col];

      if (value === null || value === undefined || value === '') {
        report.missingValues[col]++;
        return;
      }

      totalNonNull++;

      // Check if numeric
      if (typeof value === 'number' || (!isNaN(Number(value)) && value !== '')) {
        numericCount++;
      }

      // Check if date
      if (typeof value === 'string') {
        const dateValue = new Date(value);
        if (!isNaN(dateValue.getTime()) && value.match(/\d{4}|\d{2}\/\d{2}|\d{2}-\d{2}/)) {
          dateCount++;
        }
      }
    });

    // Determine column type
    if (numericCount > totalNonNull * 0.8) {
      report.numericColumns.push(col);
      report.dataTypes[col] = 'number';
    } else if (dateCount > totalNonNull * 0.8) {
      report.dateColumns.push(col);
      report.dataTypes[col] = 'date';
    } else {
      report.dataTypes[col] = 'string';
    }
  });

  // Check for potential amount columns
  const potentialAmountCols = columns.filter(col =>
    ['amount', 'balance', 'credit', 'debit', 'total', 'sum', 'value']
      .some(keyword => col.toLowerCase().includes(keyword))
  );

  potentialAmountCols.forEach(col => {
    if (!report.numericColumns.includes(col)) {
      report.issues.push(`Potential amount column '${col}' is not numeric`);
    }
  });

  // Check for duplicates (simplified check)
  const stringifiedRows = data.map(row => JSON.stringify(row));
  const uniqueRows = new Set(stringifiedRows);
  report.duplicateRows = stringifiedRows.length - uniqueRows.size;

  if (report.duplicateRows > 0) {
    report.issues.push(`Found ${report.duplicateRows} duplicate rows`);
  }

  return report;
}

export function processCsvFile(file: File): Promise<{ data: TransactionData[]; report: ValidationReport }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => {
        // Try to convert to number if it looks like one
        if (value.trim() === '') return null;
        const numValue = Number(value);
        return !isNaN(numValue) ? numValue : value.trim();
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          return;
        }

        const rawData = results.data as TransactionData[];
        const data = assignRowIds(rawData); // Assign unique IDs to each row
        const report = validateCsvData(data);

        resolve({ data, report });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    });
  });
}
