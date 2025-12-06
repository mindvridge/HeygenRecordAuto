// 작업 큐 관리

import { create } from 'zustand';
import { Job, JobStatus, BatchJob, BatchConfig, ScriptItem } from '@/types/heygen';

// ============================================
// 타입 정의
// ============================================

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  generating: number;
  completed: number;
  failed: number;
  cancelled: number;
  progress: number;
  estimatedTimeRemaining?: number; // 초 단위
}

export interface JobQueueOptions {
  concurrency?: number;       // 동시 처리 수 (기본값: 2)
  maxRetries?: number;        // 최대 재시도 횟수 (기본값: 3)
  retryDelay?: number;        // 재시도 대기 시간 (ms, 기본값: 5000)
  pollInterval?: number;      // 상태 폴링 간격 (ms, 기본값: 10000)
  maxPollAttempts?: number;   // 최대 폴링 횟수 (기본값: 60)
}

export interface JobResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
}

type JobProcessor = (job: Job) => Promise<JobResult>;
type StatusCallback = (job: Job, oldStatus: JobStatus) => void;
type ProgressCallback = (stats: QueueStats) => void;

// ============================================
// JobQueue 클래스
// ============================================

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private pendingQueue: string[] = [];
  private activeJobs: Set<string> = new Set();
  private isPaused: boolean = false;
  private isProcessing: boolean = false;

  private options: Required<JobQueueOptions>;
  private processor: JobProcessor | null = null;
  private onStatusChange: StatusCallback | null = null;
  private onProgress: ProgressCallback | null = null;

  // 평균 처리 시간 (초)
  private avgProcessingTime: number = 120;
  private completedTimes: number[] = [];

  constructor(options: JobQueueOptions = {}) {
    this.options = {
      concurrency: options.concurrency ?? 2,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      pollInterval: options.pollInterval ?? 10000,
      maxPollAttempts: options.maxPollAttempts ?? 60,
    };
  }

  // ============================================
  // 설정 메서드
  // ============================================

  setProcessor(processor: JobProcessor): void {
    this.processor = processor;
  }

  setStatusCallback(callback: StatusCallback): void {
    this.onStatusChange = callback;
  }

  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  setConcurrency(concurrency: number): void {
    this.options.concurrency = Math.max(1, concurrency);
    if (this.isProcessing && !this.isPaused) {
      this.processNext();
    }
  }

  // ============================================
  // 작업 관리 메서드
  // ============================================

  addJob(script: string, filename: string, options?: Partial<Job>): Job {
    const job: Job = {
      id: this.generateId(),
      script,
      filename,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      ...options,
    };

    this.jobs.set(job.id, job);
    this.pendingQueue.push(job.id);
    this.notifyProgress();

    return job;
  }

  addJobs(items: ScriptItem[], defaultAvatarId?: string, defaultVoiceId?: string): Job[] {
    const jobs: Job[] = [];

    for (const item of items) {
      const job = this.addJob(
        item.script,
        item.filename || `video_${item.id}`,
        {
          avatarId: item.avatarId || defaultAvatarId,
          voiceId: item.voiceId || defaultVoiceId,
        }
      );
      jobs.push(job);
    }

    return jobs;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  getJobsByStatus(status: JobStatus): Job[] {
    return this.getAllJobs().filter((job) => job.status === status);
  }

  removeJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    // 활성 작업은 제거할 수 없음
    if (this.activeJobs.has(id)) {
      return false;
    }

    // 대기 큐에서 제거
    const pendingIndex = this.pendingQueue.indexOf(id);
    if (pendingIndex !== -1) {
      this.pendingQueue.splice(pendingIndex, 1);
    }

    this.jobs.delete(id);
    this.notifyProgress();
    return true;
  }

  clearCompleted(): number {
    let count = 0;
    const idsToDelete: string[] = [];

    this.jobs.forEach((job, id) => {
      if (job.status === 'completed' || job.status === 'cancelled') {
        idsToDelete.push(id);
      }
    });

    idsToDelete.forEach((id) => {
      this.jobs.delete(id);
      count++;
    });

    this.notifyProgress();
    return count;
  }

  clearAll(): void {
    // 활성 작업이 없을 때만 전체 삭제
    if (this.activeJobs.size > 0) {
      throw new Error('활성 작업이 있을 때는 전체 삭제할 수 없습니다.');
    }

    this.jobs.clear();
    this.pendingQueue = [];
    this.notifyProgress();
  }

  // ============================================
  // 상태 업데이트 메서드
  // ============================================

  updateJobStatus(id: string, status: JobStatus, result?: Partial<JobResult>): void {
    const job = this.jobs.get(id);
    if (!job) return;

    const oldStatus = job.status;
    job.status = status;

    if (status === 'processing' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();

      // 처리 시간 기록 (평균 계산용)
      if (job.startedAt && status === 'completed') {
        const processingTime = (job.completedAt.getTime() - job.startedAt.getTime()) / 1000;
        this.completedTimes.push(processingTime);
        if (this.completedTimes.length > 10) {
          this.completedTimes.shift();
        }
        this.avgProcessingTime = this.completedTimes.reduce((a, b) => a + b, 0) / this.completedTimes.length;
      }
    }

    if (result) {
      if (result.videoId) job.videoId = result.videoId;
      if (result.videoUrl) job.videoUrl = result.videoUrl;
      if (result.thumbnailUrl) job.thumbnailUrl = result.thumbnailUrl;
      if (result.duration) job.duration = result.duration;
      if (result.error) job.error = result.error;
    }

    this.onStatusChange?.(job, oldStatus);
    this.notifyProgress();
  }

  // ============================================
  // 처리 제어 메서드
  // ============================================

  async start(): Promise<void> {
    if (!this.processor) {
      throw new Error('프로세서가 설정되지 않았습니다.');
    }

    this.isProcessing = true;
    this.isPaused = false;
    this.processNext();
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      if (this.isProcessing) {
        this.processNext();
      }
    }
  }

  stop(): void {
    this.isProcessing = false;
    this.isPaused = false;
  }

  // ============================================
  // 내부 처리 메서드
  // ============================================

  private async processNext(): Promise<void> {
    if (!this.isProcessing || this.isPaused) return;
    if (!this.processor) return;

    // 동시 처리 제한 확인
    while (
      this.activeJobs.size < this.options.concurrency &&
      this.pendingQueue.length > 0 &&
      !this.isPaused
    ) {
      const jobId = this.pendingQueue.shift();
      if (!jobId) break;

      const job = this.jobs.get(jobId);
      if (!job || job.status !== 'pending') continue;

      this.activeJobs.add(jobId);
      this.processJob(job);
    }
  }

  private async processJob(job: Job): Promise<void> {
    try {
      this.updateJobStatus(job.id, 'processing');

      const result = await this.processor!(job);

      if (result.success) {
        this.updateJobStatus(job.id, 'completed', result);
      } else {
        await this.handleJobFailure(job, result.error || '알 수 없는 오류');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '처리 중 오류 발생';
      await this.handleJobFailure(job, errorMessage);
    } finally {
      this.activeJobs.delete(job.id);
      this.processNext();
    }
  }

  private async handleJobFailure(job: Job, error: string): Promise<void> {
    job.retryCount++;

    if (job.retryCount < this.options.maxRetries) {
      // 재시도
      console.warn(`작업 ${job.id} 재시도 (${job.retryCount}/${this.options.maxRetries}): ${error}`);

      job.status = 'pending';
      job.error = `재시도 예정 (${job.retryCount}/${this.options.maxRetries}): ${error}`;

      // 재시도 대기 후 큐에 다시 추가
      setTimeout(() => {
        if (this.jobs.has(job.id) && job.status === 'pending') {
          this.pendingQueue.push(job.id);
          this.processNext();
        }
      }, this.options.retryDelay);
    } else {
      // 최대 재시도 초과
      this.updateJobStatus(job.id, 'failed', { error });
    }
  }

  // ============================================
  // 통계 메서드
  // ============================================

  getStats(): QueueStats {
    const jobs = this.getAllJobs();
    const total = jobs.length;
    const pending = jobs.filter((j) => j.status === 'pending').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const generating = jobs.filter((j) => j.status === 'generating').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const cancelled = jobs.filter((j) => j.status === 'cancelled').length;

    const finishedCount = completed + failed + cancelled;
    const progress = total > 0 ? (finishedCount / total) * 100 : 0;

    // 남은 시간 추정
    const remainingJobs = pending + processing + generating;
    const estimatedTimeRemaining = remainingJobs > 0
      ? Math.ceil((remainingJobs / this.options.concurrency) * this.avgProcessingTime)
      : 0;

    return {
      total,
      pending,
      processing,
      generating,
      completed,
      failed,
      cancelled,
      progress,
      estimatedTimeRemaining,
    };
  }

  getProgress(): number {
    return this.getStats().progress;
  }

  isActive(): boolean {
    return this.isProcessing && !this.isPaused;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  // ============================================
  // 유틸리티 메서드
  // ============================================

  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private notifyProgress(): void {
    this.onProgress?.(this.getStats());
  }
}

// ============================================
// 싱글톤 인스턴스 생성 헬퍼
// ============================================

let queueInstance: JobQueue | null = null;

export function getJobQueue(options?: JobQueueOptions): JobQueue {
  if (!queueInstance) {
    queueInstance = new JobQueue(options);
  }
  return queueInstance;
}

export function resetJobQueue(): void {
  queueInstance = null;
}

// ============================================
// 기존 Zustand 스토어 (하위 호환성 유지)
// ============================================

interface QueueState {
  jobs: BatchJob[];
  config: BatchConfig | null;
  isProcessing: boolean;
  currentJobIndex: number;

  setConfig: (config: BatchConfig) => void;
  addJobs: (texts: string[]) => void;
  updateJob: (id: string, updates: Partial<BatchJob>) => void;
  startProcessing: () => void;
  stopProcessing: () => void;
  nextJob: () => void;
  resetQueue: () => void;
  getStats: () => QueueStats;
}

function generateLegacyId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
      id: generateLegacyId(),
      status: 'pending' as const,
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

    return {
      total,
      pending,
      processing,
      generating: 0,
      completed,
      failed,
      cancelled: 0,
      progress,
    };
  },
}));

// ============================================
// API 키 저장소
// ============================================

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

// ============================================
// 폴링 유틸리티
// ============================================

export async function pollVideoStatus(
  videoId: string,
  apiKey: string,
  onStatusUpdate: (status: string, data?: unknown) => void,
  maxAttempts = 60,
  intervalMs = 10000
): Promise<{ success: boolean; videoUrl?: string; thumbnailUrl?: string; duration?: number; error?: string }> {
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
          thumbnailUrl: result.data?.thumbnail_url,
          duration: result.data?.duration,
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
