// 비디오 생성 상태 관리 스토어

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Job, JobStatus, BatchInfo, VideoSettings, ScriptItem } from '@/types/heygen';

// ============================================
// 타입 정의
// ============================================

export interface VideoStoreState {
  // 상태
  jobs: Job[];
  currentBatch: BatchInfo | null;
  settings: VideoSettings;
  isProcessing: boolean;
  isPaused: boolean;
  error: string | null;

  // 액션
  addJobs: (scripts: ScriptItem[]) => void;
  addJob: (script: string, filename: string, options?: Partial<Job>) => Job;
  updateJobStatus: (jobId: string, status: JobStatus, result?: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  clearCompleted: () => void;
  clearFailed: () => void;
  clearAll: () => void;
  retryFailed: () => void;
  retryJob: (jobId: string) => void;

  // 배치 관리
  startBatch: (name?: string) => void;
  updateBatchProgress: () => void;
  endBatch: () => void;

  // 처리 제어
  startProcessing: () => void;
  pauseProcessing: () => void;
  resumeProcessing: () => void;
  stopProcessing: () => void;

  // 설정
  setSettings: (settings: Partial<VideoSettings>) => void;
  setError: (error: string | null) => void;

  // 통계
  getStats: () => VideoStoreStats;
  getJobById: (id: string) => Job | undefined;
  getJobsByStatus: (status: JobStatus) => Job[];
  getPendingJobs: () => Job[];
  getNextPendingJob: () => Job | undefined;
}

export interface VideoStoreStats {
  total: number;
  pending: number;
  processing: number;
  generating: number;
  completed: number;
  failed: number;
  cancelled: number;
  progress: number;
  successRate: number;
  estimatedTimeRemaining: number; // 초 단위
}

// ============================================
// 유틸리티 함수
// ============================================

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 평균 처리 시간 계산용
let completedTimes: number[] = [];
const AVG_PROCESSING_TIME = 120; // 기본 2분

function updateAvgProcessingTime(time: number): number {
  completedTimes.push(time);
  if (completedTimes.length > 10) {
    completedTimes.shift();
  }
  return completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length;
}

// ============================================
// Zustand 스토어
// ============================================

export const useVideoStore = create<VideoStoreState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      jobs: [],
      currentBatch: null,
      settings: {
        avatarId: '',
        voiceId: '',
        aspectRatio: '16:9',
        testMode: false,
        backgroundColor: '#ffffff',
      },
      isProcessing: false,
      isPaused: false,
      error: null,

      // ============================================
      // 작업 관리 액션
      // ============================================

      addJobs: (scripts: ScriptItem[]) => {
        const { settings } = get();

        const newJobs: Job[] = scripts.map((script) => ({
          id: generateId(),
          script: script.script,
          filename: script.filename || `video_${script.id}`,
          status: 'pending' as JobStatus,
          avatarId: script.avatarId || settings.avatarId,
          voiceId: script.voiceId || settings.voiceId,
          retryCount: 0,
          createdAt: new Date(),
        }));

        set((state) => ({
          jobs: [...state.jobs, ...newJobs],
        }));
      },

      addJob: (script: string, filename: string, options?: Partial<Job>) => {
        const { settings } = get();

        const job: Job = {
          id: generateId(),
          script,
          filename,
          status: 'pending',
          avatarId: settings.avatarId,
          voiceId: settings.voiceId,
          retryCount: 0,
          createdAt: new Date(),
          ...options,
        };

        set((state) => ({
          jobs: [...state.jobs, job],
        }));

        return job;
      },

      updateJobStatus: (jobId: string, status: JobStatus, result?: Partial<Job>) => {
        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== jobId) return job;

            const updates: Partial<Job> = { status };

            if (status === 'processing' && !job.startedAt) {
              updates.startedAt = new Date();
            }

            if (status === 'completed' || status === 'failed') {
              updates.completedAt = new Date();

              // 처리 시간 기록
              if (job.startedAt && status === 'completed') {
                const processingTime = (new Date().getTime() - job.startedAt.getTime()) / 1000;
                updateAvgProcessingTime(processingTime);
              }
            }

            return { ...job, ...updates, ...result };
          }),
        }));

        // 배치 진행률 업데이트
        get().updateBatchProgress();
      },

      removeJob: (jobId: string) => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== jobId),
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.status !== 'completed'),
        }));
      },

      clearFailed: () => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.status !== 'failed'),
        }));
      },

      clearAll: () => {
        const { isProcessing } = get();
        if (isProcessing) {
          throw new Error('처리 중에는 작업을 삭제할 수 없습니다.');
        }

        set({
          jobs: [],
          currentBatch: null,
        });
      },

      retryFailed: () => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.status === 'failed'
              ? { ...job, status: 'pending' as JobStatus, error: undefined, retryCount: job.retryCount + 1 }
              : job
          ),
        }));
      },

      retryJob: (jobId: string) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId && job.status === 'failed'
              ? { ...job, status: 'pending' as JobStatus, error: undefined, retryCount: job.retryCount + 1 }
              : job
          ),
        }));
      },

      // ============================================
      // 배치 관리 액션
      // ============================================

      startBatch: (name?: string) => {
        const { jobs } = get();
        const pendingCount = jobs.filter((j) => j.status === 'pending').length;

        set({
          currentBatch: {
            id: generateBatchId(),
            name: name || `배치 ${new Date().toLocaleString('ko-KR')}`,
            totalJobs: pendingCount,
            completedJobs: 0,
            failedJobs: 0,
            startedAt: new Date(),
          },
          isProcessing: true,
          isPaused: false,
        });
      },

      updateBatchProgress: () => {
        const { currentBatch, jobs } = get();
        if (!currentBatch) return;

        const completedJobs = jobs.filter((j) => j.status === 'completed').length;
        const failedJobs = jobs.filter((j) => j.status === 'failed').length;

        set({
          currentBatch: {
            ...currentBatch,
            completedJobs,
            failedJobs,
          },
        });
      },

      endBatch: () => {
        set({
          currentBatch: null,
          isProcessing: false,
          isPaused: false,
        });
      },

      // ============================================
      // 처리 제어 액션
      // ============================================

      startProcessing: () => {
        const { jobs } = get();
        const hasPending = jobs.some((j) => j.status === 'pending');

        if (!hasPending) {
          throw new Error('처리할 작업이 없습니다.');
        }

        get().startBatch();
      },

      pauseProcessing: () => {
        set({ isPaused: true });
      },

      resumeProcessing: () => {
        set({ isPaused: false });
      },

      stopProcessing: () => {
        set((state) => ({
          isProcessing: false,
          isPaused: false,
          jobs: state.jobs.map((job) =>
            job.status === 'processing' || job.status === 'generating'
              ? { ...job, status: 'cancelled' as JobStatus }
              : job
          ),
        }));
        get().endBatch();
      },

      // ============================================
      // 설정 액션
      // ============================================

      setSettings: (newSettings: Partial<VideoSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      setError: (error: string | null) => {
        set({ error });
      },

      // ============================================
      // 통계 및 조회 메서드
      // ============================================

      getStats: () => {
        const { jobs } = get();
        const total = jobs.length;
        const pending = jobs.filter((j) => j.status === 'pending').length;
        const processing = jobs.filter((j) => j.status === 'processing').length;
        const generating = jobs.filter((j) => j.status === 'generating').length;
        const completed = jobs.filter((j) => j.status === 'completed').length;
        const failed = jobs.filter((j) => j.status === 'failed').length;
        const cancelled = jobs.filter((j) => j.status === 'cancelled').length;

        const finishedCount = completed + failed + cancelled;
        const progress = total > 0 ? (finishedCount / total) * 100 : 0;
        const successRate = finishedCount > 0 ? (completed / finishedCount) * 100 : 0;

        // 남은 시간 추정 (동시 처리 2개 가정)
        const remainingJobs = pending + processing + generating;
        const avgTime = completedTimes.length > 0
          ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length
          : AVG_PROCESSING_TIME;
        const estimatedTimeRemaining = Math.ceil((remainingJobs / 2) * avgTime);

        return {
          total,
          pending,
          processing,
          generating,
          completed,
          failed,
          cancelled,
          progress,
          successRate,
          estimatedTimeRemaining,
        };
      },

      getJobById: (id: string) => {
        return get().jobs.find((job) => job.id === id);
      },

      getJobsByStatus: (status: JobStatus) => {
        return get().jobs.filter((job) => job.status === status);
      },

      getPendingJobs: () => {
        return get().jobs.filter((job) => job.status === 'pending');
      },

      getNextPendingJob: () => {
        return get().jobs.find((job) => job.status === 'pending');
      },
    }),
    {
      name: 'video-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        // jobs는 세션 간 유지하지 않음 (필요시 활성화)
        // jobs: state.jobs,
      }),
    }
  )
);

// ============================================
// 선택자 (Selectors)
// ============================================

export const selectJobs = (state: VideoStoreState) => state.jobs;
export const selectSettings = (state: VideoStoreState) => state.settings;
export const selectIsProcessing = (state: VideoStoreState) => state.isProcessing;
export const selectIsPaused = (state: VideoStoreState) => state.isPaused;
export const selectCurrentBatch = (state: VideoStoreState) => state.currentBatch;
export const selectError = (state: VideoStoreState) => state.error;

// ============================================
// 훅 헬퍼
// ============================================

export function useVideoJobs() {
  return useVideoStore((state) => state.jobs);
}

export function useVideoSettings() {
  return useVideoStore((state) => state.settings);
}

export function useVideoStats() {
  return useVideoStore((state) => state.getStats());
}

export function useIsProcessing() {
  return useVideoStore((state) => state.isProcessing);
}

export function useIsPaused() {
  return useVideoStore((state) => state.isPaused);
}

export function useCurrentBatch() {
  return useVideoStore((state) => state.currentBatch);
}
