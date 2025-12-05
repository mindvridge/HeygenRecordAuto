import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';

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

    return NextResponse.json({ data: { credits } });
  } catch (error) {
    console.error('Failed to get credits:', error);
    return NextResponse.json(
      { error: '크레딧 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
