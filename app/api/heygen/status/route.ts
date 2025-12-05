import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

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

    return NextResponse.json({
      data: {
        video_id: result.data.video_id,
        status: result.data.status,
        video_url: result.data.video_url,
        thumbnail_url: result.data.thumbnail_url,
        duration: result.data.duration,
        error: result.data.error,
      }
    });
  } catch (error) {
    console.error('Failed to get video status:', error);

    if (error instanceof HeyGenApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '영상 상태 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
