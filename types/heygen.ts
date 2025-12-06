// HeyGen API 관련 타입 정의

// API 응답 기본 구조
export interface HeyGenApiResponse<T> {
  error: string | null;
  data: T;
}

// 아바타 관련 타입
export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

export interface AvatarListResponse {
  avatars: HeyGenAvatar[];
}

// 음성 관련 타입
export interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
  support_pause?: boolean;
  emotion_support?: boolean;
}

export interface VoiceListResponse {
  voices: HeyGenVoice[];
}

// 영상 생성 관련 타입
export interface VideoCharacter {
  type: 'avatar';
  avatar_id: string;
  avatar_style?: 'normal' | 'circle' | 'closeup';
}

export interface VideoVoice {
  type: 'text';
  input_text: string;
  voice_id: string;
  speed?: number;
  pitch?: number;
}

export interface VideoBackground {
  type: 'color' | 'image' | 'video';
  value: string;
}

export interface VideoInput {
  character: VideoCharacter;
  voice: VideoVoice;
  background?: VideoBackground;
}

export interface VideoDimension {
  width: number;
  height: number;
}

export interface VideoGenerateRequest {
  video_inputs: VideoInput[];
  dimension?: VideoDimension;
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  test?: boolean;
}

export interface VideoGenerateData {
  video_id: string;
}

export interface VideoGenerateResponse {
  error: string | null;
  data: VideoGenerateData;
}

// 영상 상태 관련 타입
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VideoStatusData {
  video_id: string;
  status: VideoStatus;
  video_url?: string;
  video_url_caption?: string;
  thumbnail_url?: string;
  duration?: number;
  gif_url?: string;
  error?: string;
  callback_id?: string;
}

export interface VideoStatusResponse {
  error: string | null;
  data: VideoStatusData;
}

// 크레딧 관련 타입
export interface RemainingQuotaData {
  remaining_quota: number;
}

// 배치 작업 관련 타입
export interface BatchJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text: string;
  avatarId: string;
  voiceId: string;
  videoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 확장된 작업 상태 (영상 생성 단계 포함)
export type JobStatus = 'pending' | 'processing' | 'generating' | 'completed' | 'failed' | 'cancelled';

// 확장된 작업 타입
export interface Job {
  id: string;
  script: string;
  filename: string;
  status: JobStatus;
  avatarId?: string;
  voiceId?: string;
  videoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
  retryCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// 배치 정보
export interface BatchInfo {
  id: string;
  name: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  startedAt: Date;
  estimatedEndAt?: Date;
}

// 비디오 설정
export interface VideoSettings {
  avatarId: string;
  voiceId: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  testMode: boolean;
  backgroundColor?: string;
}

export interface BatchConfig {
  avatarId: string;
  voiceId: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  testMode: boolean;
}

export interface ExcelRow {
  text: string;
  [key: string]: string;
}

// 스크립트 아이템 타입 (엑셀 파싱 결과)
export interface ScriptItem {
  id: string;
  script: string;
  filename?: string;
  avatarId?: string;
  voiceId?: string;
  rowNumber: number;
}

// 엑셀 유효성 검사 결과
export interface ValidationResult {
  isValid: boolean;
  validItems: ScriptItem[];
  invalidItems: Array<{
    item: ScriptItem;
    errors: string[];
  }>;
  warnings: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    empty: number;
  };
}

// 엑셀 파싱 옵션
export interface ExcelParseOptions {
  headerRow?: number;          // 헤더 행 번호 (0부터 시작, 기본값: 자동 감지)
  scriptColumn?: string;       // 스크립트 컬럼명 또는 인덱스
  idColumn?: string;           // ID 컬럼명 또는 인덱스
  filenameColumn?: string;     // 파일명 컬럼명 또는 인덱스
  avatarIdColumn?: string;     // 아바타 ID 컬럼명 또는 인덱스
  voiceIdColumn?: string;      // 음성 ID 컬럼명 또는 인덱스
  defaultAvatarId?: string;    // 기본 아바타 ID
  defaultVoiceId?: string;     // 기본 음성 ID
  maxScriptLength?: number;    // 최대 스크립트 길이 (기본값: 5000)
  skipEmptyRows?: boolean;     // 빈 행 건너뛰기 (기본값: true)
}

// 에러 타입
export interface HeyGenError {
  code: string;
  message: string;
}

export class HeyGenApiError extends Error {
  code: string;
  statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'HeyGenApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
