import { NextRequest, NextResponse } from 'next/server';
import { createHeyGenClient, buildVideoRequest } from '@/lib/heygen';
import { HeyGenApiError } from '@/types/heygen';

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
    const {
      text,
      avatarId,
      voiceId,
      aspectRatio,
      testMode,
      backgroundColor,
      avatarStyle,
      speed,
      pitch
    } = body;

    if (!text || !avatarId || !voiceId) {
      return NextResponse.json(
        { error: '텍스트, 아바타 ID, 음성 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 텍스트 길이 검증 (HeyGen 제한)
    if (text.length > 5000) {
      return NextResponse.json(
        { error: '텍스트는 5000자를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    const client = createHeyGenClient(apiKey);
    const videoRequest = buildVideoRequest(text, avatarId, voiceId, {
      aspectRatio,
      testMode,
      backgroundColor,
      avatarStyle,
      speed,
      pitch,
    });

    const result = await client.generateVideo(videoRequest);

    return NextResponse.json({
      data: {
        video_id: result.data.video_id,
        message: '영상 생성이 시작되었습니다.',
      }
    });
  } catch (error) {
    console.error('Failed to generate video:', error);

    if (error instanceof HeyGenApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: '영상 생성 요청에 실패했습니다.' },
      { status: 500 }
    );
  }
}
