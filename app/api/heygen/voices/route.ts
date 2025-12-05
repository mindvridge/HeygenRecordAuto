import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const language = searchParams.get('language'); // 언어 필터 (예: 'Korean', 'English')
  const koreanOnly = searchParams.get('koreanOnly') === 'true'; // 한국어만 필터

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API 키가 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const client = createHeyGenClient(apiKey);

    let voices;
    if (koreanOnly) {
      voices = await client.getKoreanVoices();
    } else if (language) {
      voices = await client.getVoices(language);
    } else {
      voices = await client.getVoices();
    }

    return NextResponse.json({
      data: {
        voices,
        count: voices.length,
        filter: koreanOnly ? 'Korean' : language || 'all'
      }
    });
  } catch (error) {
    console.error('Failed to fetch voices:', error);

    if (error instanceof HeyGenApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '음성 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
