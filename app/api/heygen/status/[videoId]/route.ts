import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

interface RouteParams {
  params: Promise<{
    videoId: string;
  }>;
}

/**
 * GET /api/heygen/status/[videoId]
 * 영상 생성 상태를 확인합니다.
 *
 * Headers:
 *   x-api-key: HeyGen API 키
 *
 * Path Parameters:
 *   videoId: 영상 ID
 *
 * Response:
 *   {
 *     videoId: string,
 *     status: 'pending' | 'processing' | 'completed' | 'failed',
 *     videoUrl?: string,       // 완료시 포함
 *     thumbnailUrl?: string,   // 완료시 포함
 *     duration?: number,       // 완료시 포함
 *     error?: string           // 실패시 포함
 *   }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  const { videoId } = resolvedParams;
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] GET /api/heygen/status/${videoId} - 요청 시작`);

  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    console.warn(`[${requestId}] API 키 누락`);
    return NextResponse.json(
      { error: 'API 키가 필요합니다.', code: 'MISSING_API_KEY' },
      { status: 401 }
    );
  }

  if (!videoId) {
    console.warn(`[${requestId}] 비디오 ID 누락`);
    return NextResponse.json(
      { error: '비디오 ID가 필요합니다.', code: 'MISSING_VIDEO_ID' },
      { status: 400 }
    );
  }

  try {
    const client = createHeyGenClient(apiKey);
    console.log(`[${requestId}] HeyGen API 상태 조회 중...`);

    const result = await client.getVideoStatus(videoId);
    const { status, video_url, thumbnail_url, duration, error } = result.data;

    console.log(`[${requestId}] 영상 상태: ${status}${video_url ? ', URL 있음' : ''}`);

    // 응답 구성
    const response: {
      success: boolean;
      videoId: string;
      status: string;
      videoUrl?: string;
      thumbnailUrl?: string;
      duration?: number;
      error?: string;
    } = {
      success: true,
      videoId,
      status,
    };

    // 완료된 경우 추가 정보 포함
    if (status === 'completed') {
      if (video_url) response.videoUrl = video_url;
      if (thumbnail_url) response.thumbnailUrl = thumbnail_url;
      if (duration) response.duration = duration;
    }

    // 실패한 경우 에러 정보 포함
    if (status === 'failed' && error) {
      response.error = error;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[${requestId}] 영상 상태 조회 실패:`, error);

    if (error instanceof HeyGenApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode || 500 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      {
        success: false,
        error: '영상 상태 조회에 실패했습니다.',
        detail: errorMessage,
        code: 'STATUS_CHECK_ERROR',
      },
      { status: 500 }
    );
  }
}
