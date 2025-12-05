// HeyGen API 클라이언트

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  HeyGenAvatar,
  HeyGenVoice,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoStatusResponse,
  VideoStatusData,
  HeyGenApiError,
} from '@/types/heygen';

// API 기본 설정
const HEYGEN_API_BASE = 'https://api.heygen.com';
const DEFAULT_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// 영상 해상도 설정
export const VIDEO_DIMENSIONS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
} as const;

/**
 * 지정된 시간만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 지수 백오프 계산
 */
function getBackoffDelay(attempt: number, baseDelay: number = RETRY_DELAY_MS): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * HeyGen API 클라이언트 클래스
 */
class HeyGenClient {
  private client: AxiosInstance;
  private maxRetries: number;

  constructor(apiKey?: string, maxRetries: number = DEFAULT_RETRY_COUNT) {
    const key = apiKey || process.env.HEYGEN_API_KEY;

    if (!key) {
      throw new HeyGenApiError(
        'HeyGen API 키가 설정되지 않았습니다. 환경변수 HEYGEN_API_KEY를 설정하거나 API 키를 직접 전달하세요.',
        'MISSING_API_KEY'
      );
    }

    this.maxRetries = maxRetries;
    this.client = axios.create({
      baseURL: HEYGEN_API_BASE,
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30초 타임아웃
    });
  }

  /**
   * 재시도 로직이 포함된 API 요청 실행
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Axios 에러인 경우
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          const statusCode = axiosError.response?.status;

          // 재시도 불가능한 에러 (클라이언트 에러)
          if (statusCode && statusCode >= 400 && statusCode < 500 && !RETRYABLE_STATUS_CODES.includes(statusCode)) {
            const errorMessage = (axiosError.response?.data as { error?: string })?.error || axiosError.message;
            throw new HeyGenApiError(
              `${operationName} 실패: ${errorMessage}`,
              'API_ERROR',
              statusCode
            );
          }

          // 재시도 가능한 에러
          if (attempt < this.maxRetries) {
            const delay = getBackoffDelay(attempt);
            console.warn(
              `${operationName} 실패 (시도 ${attempt + 1}/${this.maxRetries + 1}), ${delay}ms 후 재시도...`
            );
            await sleep(delay);
            continue;
          }
        }

        // 마지막 시도 실패
        if (attempt === this.maxRetries) {
          throw new HeyGenApiError(
            `${operationName} 실패: ${this.maxRetries + 1}회 시도 후 실패 - ${lastError.message}`,
            'MAX_RETRIES_EXCEEDED'
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * 아바타 목록 조회
   */
  async getAvatars(): Promise<HeyGenAvatar[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/v2/avatars');

      if (response.data.error) {
        throw new HeyGenApiError(response.data.error, 'AVATAR_LIST_ERROR');
      }

      return response.data.data?.avatars || [];
    }, '아바타 목록 조회');
  }

  /**
   * 음성 목록 조회
   * @param language 언어 필터 (예: 'Korean', 'English')
   */
  async getVoices(language?: string): Promise<HeyGenVoice[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/v2/voices');

      if (response.data.error) {
        throw new HeyGenApiError(response.data.error, 'VOICE_LIST_ERROR');
      }

      let voices: HeyGenVoice[] = response.data.data?.voices || [];

      // 언어 필터링
      if (language) {
        voices = voices.filter((voice) =>
          voice.language.toLowerCase().includes(language.toLowerCase())
        );
      }

      return voices;
    }, '음성 목록 조회');
  }

  /**
   * 한국어 음성 목록 조회 (편의 메서드)
   */
  async getKoreanVoices(): Promise<HeyGenVoice[]> {
    return this.getVoices('Korean');
  }

  /**
   * 영상 생성 요청
   */
  async generateVideo(request: VideoGenerateRequest): Promise<VideoGenerateResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post('/v2/video/generate', request);

      if (response.data.error) {
        throw new HeyGenApiError(response.data.error, 'VIDEO_GENERATE_ERROR');
      }

      return response.data;
    }, '영상 생성 요청');
  }

  /**
   * 영상 상태 조회
   */
  async getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/v1/video_status.get?video_id=${videoId}`);

      if (response.data.error) {
        throw new HeyGenApiError(response.data.error, 'VIDEO_STATUS_ERROR');
      }

      return response.data;
    }, '영상 상태 조회');
  }

  /**
   * 영상 완료까지 대기 후 URL 반환
   * @param videoId 영상 ID
   * @param maxWaitTime 최대 대기 시간 (ms), 기본값 10분
   * @param pollInterval 폴링 간격 (ms), 기본값 10초
   */
  async waitForVideoCompletion(
    videoId: string,
    maxWaitTime: number = 600000,
    pollInterval: number = 10000
  ): Promise<VideoStatusData> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await this.getVideoStatus(videoId);
      const { status, video_url, error } = statusResponse.data;

      if (status === 'completed' && video_url) {
        return statusResponse.data;
      }

      if (status === 'failed') {
        throw new HeyGenApiError(
          `영상 생성 실패: ${error || '알 수 없는 오류'}`,
          'VIDEO_GENERATION_FAILED'
        );
      }

      // pending 또는 processing 상태면 대기
      await sleep(pollInterval);
    }

    throw new HeyGenApiError(
      `영상 생성 시간 초과: ${maxWaitTime / 1000}초 내에 완료되지 않았습니다.`,
      'VIDEO_GENERATION_TIMEOUT'
    );
  }

  /**
   * 남은 크레딧 조회
   */
  async getRemainingCredits(): Promise<number> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/v1/user/remaining_quota');

      if (response.data.error) {
        throw new HeyGenApiError(response.data.error, 'CREDITS_ERROR');
      }

      return response.data.data?.remaining_quota || 0;
    }, '크레딧 조회');
  }

  /**
   * API 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getRemainingCredits();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 환경변수에서 API 키를 가져와 클라이언트 생성
 */
export function createHeyGenClient(apiKey?: string): HeyGenClient {
  return new HeyGenClient(apiKey);
}

/**
 * 서버 사이드에서 환경변수 API 키로 클라이언트 생성
 */
export function getServerHeyGenClient(): HeyGenClient {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new HeyGenApiError(
      '서버 환경변수 HEYGEN_API_KEY가 설정되지 않았습니다.',
      'MISSING_SERVER_API_KEY'
    );
  }
  return new HeyGenClient(apiKey);
}

/**
 * 영상 생성 요청 빌더
 */
export function buildVideoRequest(
  text: string,
  avatarId: string,
  voiceId: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    backgroundColor?: string;
    testMode?: boolean;
    avatarStyle?: 'normal' | 'circle' | 'closeup';
    speed?: number;
    pitch?: number;
  } = {}
): VideoGenerateRequest {
  const {
    aspectRatio = '16:9',
    backgroundColor = '#ffffff',
    testMode = false,
    avatarStyle = 'normal',
    speed,
    pitch,
  } = options;

  const dimension = VIDEO_DIMENSIONS[aspectRatio];

  return {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: avatarStyle,
        },
        voice: {
          type: 'text',
          input_text: text,
          voice_id: voiceId,
          ...(speed !== undefined && { speed }),
          ...(pitch !== undefined && { pitch }),
        },
        background: {
          type: 'color',
          value: backgroundColor,
        },
      },
    ],
    dimension,
    test: testMode,
  };
}

/**
 * 여러 텍스트로 배치 영상 생성 요청
 */
export async function generateBatchVideos(
  client: HeyGenClient,
  texts: string[],
  avatarId: string,
  voiceId: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    testMode?: boolean;
    delayBetweenRequests?: number;
    onProgress?: (current: number, total: number, videoId?: string) => void;
  } = {}
): Promise<Array<{ text: string; videoId?: string; error?: string }>> {
  const { delayBetweenRequests = 1000, onProgress } = options;
  const results: Array<{ text: string; videoId?: string; error?: string }> = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    try {
      const request = buildVideoRequest(text, avatarId, voiceId, options);
      const response = await client.generateVideo(request);

      results.push({
        text,
        videoId: response.data.video_id,
      });

      onProgress?.(i + 1, texts.length, response.data.video_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      results.push({
        text,
        error: errorMessage,
      });

      onProgress?.(i + 1, texts.length);
    }

    // API 제한을 피하기 위한 딜레이
    if (i < texts.length - 1) {
      await sleep(delayBetweenRequests);
    }
  }

  return results;
}

export default HeyGenClient;
