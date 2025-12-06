import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

/**
 * GET /api/heygen/avatars
 * 사용 가능한 아바타 목록을 반환합니다.
 *
 * Headers:
 *   x-api-key: HeyGen API 키
 *
 * Response:
 *   { data: { avatars: HeyGenAvatar[], count: number } }
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] GET /api/heygen/avatars - 요청 시작`);

  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    console.warn(`[${requestId}] API 키 누락`);
    return NextResponse.json(
      { error: 'API 키가 필요합니다.', code: 'MISSING_API_KEY' },
      { status: 401 }
    );
  }

  try {
    const client = createHeyGenClient(apiKey);
    console.log(`[${requestId}] HeyGen API 호출 중...`);

    const avatars = await client.getAvatars();

    console.log(`[${requestId}] 아바타 ${avatars.length}개 조회 완료`);

    return NextResponse.json({
      success: true,
      data: {
        avatars,
        count: avatars.length,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] 아바타 조회 실패:`, error);

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
        error: '아바타 목록을 가져오는데 실패했습니다.',
        detail: errorMessage,
        code: 'AVATAR_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}
