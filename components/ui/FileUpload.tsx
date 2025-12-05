'use client';

import { useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: Accept;
  maxSize?: number;
  file?: File | null;
  onClear?: () => void;
  className?: string;
}

export default function FileUpload({
  onFileSelect,
  accept = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  file,
  onClear,
  className = '',
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (file) {
    return (
      <div className={`border border-gray-300 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <File className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </div>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          {isDragActive
            ? '파일을 여기에 놓으세요'
            : '클릭하거나 파일을 드래그하여 업로드'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Excel 파일 (.xlsx, .xls) - 최대 10MB
        </p>
      </div>
      {fileRejections.length > 0 && (
        <p className="mt-2 text-sm text-red-600">
          파일 형식이 올바르지 않거나 크기가 너무 큽니다.
        </p>
      )}
    </div>
  );
}
