'use client';

import { BatchJob } from '@/types/heygen';
import { CheckCircle, XCircle, Clock, Loader2, Video, ExternalLink } from 'lucide-react';

interface JobListProps {
  jobs: BatchJob[];
  className?: string;
}

export default function JobList({ jobs, className = '' }: JobListProps) {
  const getStatusIcon = (status: BatchJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-400" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusText = (status: BatchJob['status']) => {
    switch (status) {
      case 'pending':
        return '대기 중';
      case 'processing':
        return '처리 중';
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
    }
  };

  const getStatusColor = (status: BatchJob['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
    }
  };

  if (jobs.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <Video className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>등록된 작업이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {jobs.map((job, index) => (
        <div
          key={job.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 line-clamp-2">
                  {job.text}
                </p>
                {job.error && (
                  <p className="mt-1 text-xs text-red-600">{job.error}</p>
                )}
                {job.videoUrl && (
                  <a
                    href={job.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    영상 보기
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              {getStatusIcon(job.status)}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                {getStatusText(job.status)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
