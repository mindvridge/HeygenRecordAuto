// HeyGen API 클라이언트

import axios, { AxiosInstance } from 'axios';
import {
  HeyGenAvatar,
  HeyGenVoice,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoStatusResponse,
} from '@/types/heygen';

const HEYGEN_API_BASE = 'https://api.heygen.com';

class HeyGenClient {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: HEYGEN_API_BASE,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // 아바타 목록 조회
  async getAvatars(): Promise<HeyGenAvatar[]> {
    try {
      const response = await this.client.get('/v2/avatars');
      return response.data.data?.avatars || [];
    } catch (error) {
      console.error('Failed to fetch avatars:', error);
      throw error;
    }
  }

  // 음성 목록 조회
  async getVoices(): Promise<HeyGenVoice[]> {
    try {
      const response = await this.client.get('/v2/voices');
      return response.data.data?.voices || [];
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      throw error;
    }
  }

  // 영상 생성 요청
  async generateVideo(request: VideoGenerateRequest): Promise<VideoGenerateResponse> {
    try {
      const response = await this.client.post('/v2/video/generate', request);
      return response.data;
    } catch (error) {
      console.error('Failed to generate video:', error);
      throw error;
    }
  }

  // 영상 상태 조회
  async getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
    try {
      const response = await this.client.get(`/v1/video_status.get?video_id=${videoId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get video status:', error);
      throw error;
    }
  }

  // 남은 크레딧 조회
  async getRemainingCredits(): Promise<number> {
    try {
      const response = await this.client.get('/v1/user/remaining_quota');
      return response.data.data?.remaining_quota || 0;
    } catch (error) {
      console.error('Failed to get remaining credits:', error);
      throw error;
    }
  }
}

// 클라이언트 인스턴스 생성 헬퍼
export function createHeyGenClient(apiKey: string): HeyGenClient {
  return new HeyGenClient(apiKey);
}

// 영상 생성 요청 빌더
export function buildVideoRequest(
  text: string,
  avatarId: string,
  voiceId: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    backgroundColor?: string;
    testMode?: boolean;
  } = {}
): VideoGenerateRequest {
  const { aspectRatio = '16:9', backgroundColor = '#ffffff', testMode = false } = options;

  return {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          input_text: text,
          voice_id: voiceId,
        },
        background: {
          type: 'color',
          value: backgroundColor,
        },
      },
    ],
    aspect_ratio: aspectRatio,
    test: testMode,
  };
}

export default HeyGenClient;
