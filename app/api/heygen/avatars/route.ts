import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API 키가 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const client = createHeyGenClient(apiKey);
    const avatars = await client.getAvatars();

    return NextResponse.json({
      data: {
        avatars,
        count: avatars.length
      }
    });
  } catch (error) {
    console.error('Failed to fetch avatars:', error);

    if (error instanceof HeyGenApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '아바타 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
