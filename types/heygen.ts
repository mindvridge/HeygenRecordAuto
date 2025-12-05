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
