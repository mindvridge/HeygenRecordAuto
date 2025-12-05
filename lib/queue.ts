// 작업 큐 관리

import { create } from 'zustand';
import { BatchJob, BatchConfig } from '@/types/heygen';

interface QueueState {
  jobs: BatchJob[];
  config: BatchConfig | null;
  isProcessing: boolean;
  currentJobIndex: number;

  // Actions
  setConfig: (config: BatchConfig) => void;
  addJobs: (texts: string[]) => void;
  updateJob: (id: string, updates: Partial<BatchJob>) => void;
  startProcessing: () => void;
  stopProcessing: () => void;
  nextJob: () => void;
  resetQueue: () => void;
  getStats: () => QueueStats;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  progress: number;
}

// 고유 ID 생성
function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  config: null,
  isProcessing: false,
  currentJobIndex: 0,

  setConfig: (config) => set({ config }),

  addJobs: (texts) => {
    const { config } = get();
    if (!config) return;

    const newJobs: BatchJob[] = texts.map((text) => ({
      id: generateId(),
      status: 'pending',
      text,
      avatarId: config.avatarId,
      voiceId: config.voiceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    set((state) => ({
      jobs: [...state.jobs, ...newJobs],
    }));
  },

  updateJob: (id, updates) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id
          ? { ...job, ...updates, updatedAt: new Date() }
          : job
      ),
    }));
  },

  startProcessing: () => set({ isProcessing: true }),

  stopProcessing: () => set({ isProcessing: false }),

  nextJob: () => {
    set((state) => ({
      currentJobIndex: state.currentJobIndex + 1,
    }));
  },

  resetQueue: () => {
    set({
      jobs: [],
      isProcessing: false,
      currentJobIndex: 0,
    });
  },

  getStats: () => {
    const { jobs } = get();
    const total = jobs.length;
    const pending = jobs.filter((j) => j.status === 'pending').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const progress = total > 0 ? ((completed + failed) / total) * 100 : 0;

    return { total, pending, processing, completed, failed, progress };
  },
}));

// API 키 저장소 (로컬 스토리지 사용)
interface ApiKeyState {
  apiKey: string;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

export const useApiKeyStore = create<ApiKeyState>((set) => ({
  apiKey: typeof window !== 'undefined' ? localStorage.getItem('heygen_api_key') || '' : '',

  setApiKey: (key) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('heygen_api_key', key);
    }
    set({ apiKey: key });
  },

  clearApiKey: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('heygen_api_key');
    }
    set({ apiKey: '' });
  },
}));

// 폴링 유틸리티
export async function pollVideoStatus(
  videoId: string,
  apiKey: string,
  onStatusUpdate: (status: string, data?: unknown) => void,
  maxAttempts = 60,
  intervalMs = 10000
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`/api/heygen/status?videoId=${videoId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const result = await response.json();
      const status = result.data?.status;

      onStatusUpdate(status, result.data);

      if (status === 'completed') {
        return {
          success: true,
          videoUrl: result.data?.video_url,
        };
      }

      if (status === 'failed') {
        return {
          success: false,
          error: result.data?.error || '영상 생성 실패',
        };
      }

      // 대기 후 다음 폴링
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error('Polling error:', error);
    }
  }

  return {
    success: false,
    error: '영상 생성 시간 초과',
  };
}
