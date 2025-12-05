import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient, buildVideoRequest } from '@/lib/heygen';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API 키가 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { text, avatarId, voiceId, aspectRatio, testMode } = body;

    if (!text || !avatarId || !voiceId) {
      return NextResponse.json(
        { error: '텍스트, 아바타 ID, 음성 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const client = createHeyGenClient(apiKey);
    const videoRequest = buildVideoRequest(text, avatarId, voiceId, {
      aspectRatio,
      testMode,
    });

    const result = await client.generateVideo(videoRequest);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error('Failed to generate video:', error);
    return NextResponse.json(
      { error: '영상 생성 요청에 실패했습니다.' },
      { status: 500 }
    );
  }
}
