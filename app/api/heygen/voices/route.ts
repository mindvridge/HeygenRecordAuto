import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

/**
 * GET /api/heygen/voices
 * 한국어 음성 목록을 반환합니다 (기본값: language="ko" 필터).
 *
 * Headers:
 *   x-api-key: HeyGen API 키
 *
 * Query Parameters:
 *   language: 언어 필터 (기본값: "ko", 전체 조회: "all")
 *
 * Response:
 *   { data: { voices: HeyGenVoice[], count: number, filter: string } }
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] GET /api/heygen/voices - 요청 시작`);

  const apiKey = request.headers.get('x-api-key');
  const { searchParams } = new URL(request.url);

  // 기본값: 한국어 필터
  const language = searchParams.get('language') || 'ko';
  const isAllLanguages = language.toLowerCase() === 'all';

  if (!apiKey) {
    console.warn(`[${requestId}] API 키 누락`);
    return NextResponse.json(
      { error: 'API 키가 필요합니다.', code: 'MISSING_API_KEY' },
      { status: 401 }
    );
  }

  try {
    const client = createHeyGenClient(apiKey);
    console.log(`[${requestId}] HeyGen API 호출 중... (language=${isAllLanguages ? 'all' : language})`);

    let voices;
    if (isAllLanguages) {
      voices = await client.getVoices();
    } else if (language.toLowerCase() === 'ko' || language.toLowerCase() === 'korean') {
      voices = await client.getKoreanVoices();
    } else {
      voices = await client.getVoices(language);
    }

    console.log(`[${requestId}] 음성 ${voices.length}개 조회 완료`);

    return NextResponse.json({
      success: true,
      data: {
        voices,
        count: voices.length,
        filter: isAllLanguages ? 'all' : language,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] 음성 조회 실패:`, error);

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
        error: '음성 목록을 가져오는데 실패했습니다.',
        detail: errorMessage,
        code: 'VOICE_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}
