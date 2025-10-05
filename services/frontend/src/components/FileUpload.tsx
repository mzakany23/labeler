'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isLoading?: boolean;
}

export default function FileUpload({ onFileUpload, isLoading = false }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          ) : (
            <Upload className="h-12 w-12 text-gray-400" />
          )}

          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a CSV file here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to select a file
            </p>
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <FileText className="h-4 w-4" />
            <span>Supports CSV, XLS, XLSX files</span>
          </div>
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">File rejected:</span>
          </div>
          <ul className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fileRejections.map((rejection, index) => (
              <li key={index}>
                {rejection.file.name} - {rejection.errors.map(e => e.message).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
