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
    const { texts, avatarId, voiceId, aspectRatio, testMode } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: '텍스트 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!avatarId || !voiceId) {
      return NextResponse.json(
        { error: '아바타 ID와 음성 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const client = createHeyGenClient(apiKey);
    const results: Array<{
      text: string;
      success: boolean;
      videoId?: string;
      error?: string;
    }> = [];

    // 배치 처리 (순차 처리 - API 제한 고려)
    for (const text of texts) {
      try {
        const videoRequest = buildVideoRequest(text, avatarId, voiceId, {
          aspectRatio,
          testMode,
        });

        const result = await client.generateVideo(videoRequest);

        if (result.error) {
          results.push({
            text,
            success: false,
            error: result.error,
          });
        } else {
          results.push({
            text,
            success: true,
            videoId: result.data.video_id,
          });
        }

        // API 제한을 피하기 위한 딜레이 (1초)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          text,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      data: {
        results,
        summary: {
          total: texts.length,
          success: successCount,
          failed: failCount,
        },
      },
    });
  } catch (error) {
    console.error('Batch processing failed:', error);
    return NextResponse.json(
      { error: '배치 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
