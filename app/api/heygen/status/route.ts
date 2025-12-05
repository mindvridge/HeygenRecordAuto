import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API 키가 필요합니다.' },
      { status: 401 }
    );
  }

  if (!videoId) {
    return NextResponse.json(
      { error: '비디오 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const client = createHeyGenClient(apiKey);
    const result = await client.getVideoStatus(videoId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error('Failed to get video status:', error);
    return NextResponse.json(
      { error: '영상 상태 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
