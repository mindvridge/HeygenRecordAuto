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
    const credits = await client.getRemainingCredits();
    const isValid = await client.testConnection();

    return NextResponse.json({
      data: {
        credits,
        isValid,
      }
    });
  } catch (error) {
    console.error('Failed to get credits:', error);

    if (error instanceof HeyGenApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '크레딧 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
