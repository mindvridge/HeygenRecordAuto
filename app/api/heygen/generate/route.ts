import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient, buildVideoRequest } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

/**
 * POST /api/heygen/generate
 * 단일 영상 생성을 요청합니다.
 *
 * Headers:
 *   x-api-key: HeyGen API 키
 *
 * Body:
 *   {
 *     script: string,      // 영상 스크립트 (필수)
 *     avatarId: string,    // 아바타 ID (필수)
 *     voiceId: string,     // 음성 ID (필수)
 *     aspectRatio?: '16:9' | '9:16' | '1:1',
 *     testMode?: boolean,
 *     backgroundColor?: string,
 *     avatarStyle?: 'normal' | 'circle' | 'closeup',
 *     speed?: number,
 *     pitch?: number
 *   }
 *
 * Response:
 *   { videoId: string, status: 'pending' }
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] POST /api/heygen/generate - 요청 시작`);

  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    console.warn(`[${requestId}] API 키 누락`);
    return NextResponse.json(
      { error: 'API 키가 필요합니다.', code: 'MISSING_API_KEY' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      script,
      avatarId,
      voiceId,
      aspectRatio = '16:9',
      testMode = false,
      backgroundColor = '#ffffff',
      avatarStyle = 'normal',
      speed,
      pitch,
    } = body;

    // 필수 파라미터 검증
    if (!script) {
      console.warn(`[${requestId}] 스크립트 누락`);
      return NextResponse.json(
        { error: '스크립트가 필요합니다.', code: 'MISSING_SCRIPT' },
        { status: 400 }
      );
    }

    if (!avatarId) {
      console.warn(`[${requestId}] 아바타 ID 누락`);
      return NextResponse.json(
        { error: '아바타 ID가 필요합니다.', code: 'MISSING_AVATAR_ID' },
        { status: 400 }
      );
    }

    if (!voiceId) {
      console.warn(`[${requestId}] 음성 ID 누락`);
      return NextResponse.json(
        { error: '음성 ID가 필요합니다.', code: 'MISSING_VOICE_ID' },
        { status: 400 }
      );
    }

    // 스크립트 길이 검증 (HeyGen 제한: 5000자)
    if (script.length > 5000) {
      console.warn(`[${requestId}] 스크립트 길이 초과: ${script.length}자`);
      return NextResponse.json(
        {
          error: '스크립트는 5000자를 초과할 수 없습니다.',
          code: 'SCRIPT_TOO_LONG',
          detail: { length: script.length, maxLength: 5000 },
        },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] 영상 생성 요청 - avatar: ${avatarId}, voice: ${voiceId}, script: ${script.length}자`);

    const client = createHeyGenClient(apiKey);
    const videoRequest = buildVideoRequest(script, avatarId, voiceId, {
      aspectRatio,
      testMode,
      backgroundColor,
      avatarStyle,
      speed,
      pitch,
    });

    const result = await client.generateVideo(videoRequest);
    const videoId = result.data.video_id;

    console.log(`[${requestId}] 영상 생성 시작됨 - videoId: ${videoId}`);

    return NextResponse.json({
      success: true,
      videoId,
      status: 'pending',
      message: '영상 생성이 시작되었습니다.',
    });
  } catch (error) {
    console.error(`[${requestId}] 영상 생성 실패:`, error);

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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: '잘못된 JSON 형식입니다.',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      {
        success: false,
        error: '영상 생성 요청에 실패했습니다.',
        detail: errorMessage,
        code: 'VIDEO_GENERATE_ERROR',
      },
      { status: 500 }
    );
  }
}
