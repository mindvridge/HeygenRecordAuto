'use client';

import { QueueStats as QueueStatsType } from '@/lib/queue';
import Progress from '@/components/ui/Progress';
import { Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface QueueStatsProps {
  stats: QueueStatsType;
  className?: string;
}

export default function QueueStats({ stats, className = '' }: QueueStatsProps) {
  const { total, pending, processing, completed, failed, progress } = stats;

  const getProgressVariant = () => {
    if (failed > 0 && completed === 0) return 'danger';
    if (failed > 0) return 'warning';
    if (progress === 100) return 'success';
    return 'default';
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">전체 진행률</span>
          <span className="text-sm text-gray-500">{completed + failed} / {total}</span>
        </div>
        <Progress value={progress} showLabel variant={getProgressVariant()} size="md" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-900">{pending}</span>
          </div>
          <span className="text-xs text-gray-500">대기 중</span>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Loader2 className="h-4 w-4 text-blue-600 mr-1" />
            <span className="text-lg font-semibold text-gray-900">{processing}</span>
          </div>
          <span className="text-xs text-gray-500">처리 중</span>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
            <span className="text-lg font-semibold text-gray-900">{completed}</span>
          </div>
          <span className="text-xs text-gray-500">완료</span>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <XCircle className="h-4 w-4 text-red-600 mr-1" />
            <span className="text-lg font-semibold text-gray-900">{failed}</span>
          </div>
          <span className="text-xs text-gray-500">실패</span>
        </div>
      </div>
    </div>
  );
}
