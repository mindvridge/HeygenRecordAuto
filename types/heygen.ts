// HeyGen API 관련 타입 정의

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
}

export interface VideoInput {
  character: {
    type: 'avatar';
    avatar_id: string;
    avatar_style?: 'normal' | 'circle' | 'closeup';
  };
  voice: {
    type: 'text';
    input_text: string;
    voice_id: string;
    speed?: number;
    pitch?: number;
  };
  background?: {
    type: 'color' | 'image' | 'video';
    value: string;
  };
}

export interface VideoGenerateRequest {
  video_inputs: VideoInput[];
  dimension?: {
    width: number;
    height: number;
  };
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  test?: boolean;
}

export interface VideoGenerateResponse {
  error: string | null;
  data: {
    video_id: string;
  };
}

export interface VideoStatusResponse {
  error: string | null;
  data: {
    video_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    gif_url?: string;
    error?: string;
  };
}

export interface BatchJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text: string;
  avatarId: string;
  voiceId: string;
  videoId?: string;
  videoUrl?: string;
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
