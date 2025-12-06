import { NextRequest } from 'next/server';
import { createHeyGenClient, buildVideoRequest } from '@/lib/heygen';
import { HeyGenApiError, ScriptItem, VideoSettings } from '@/types/heygen';

// SSE 이벤트 타입 정의
type SSEEventType =
  | 'start'
  | 'job_start'
  | 'job_generating'
  | 'job_complete'
  | 'job_failed'
  | 'progress'
  | 'complete'
  | 'error';

interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

interface BatchRequestBody {
  scripts: ScriptItem[];
  settings: VideoSettings;
  concurrency?: number;
  pollInterval?: number;
  maxPollAttempts?: number;
}

/**
 * SSE 이벤트를 포맷팅합니다.
 */
function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * 지정된 시간만큼 대기합니다.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/batch/process
 * 배치 처리를 시작하고 Server-Sent Events로 진행 상황을 스트리밍합니다.
 *
 * Headers:
 *   x-api-key: HeyGen API 키
 *
 * Body:
 *   {
 *     scripts: ScriptItem[],     // 처리할 스크립트 목록
 *     settings: VideoSettings,   // 영상 설정
 *     concurrency?: number,      // 동시 처리 수 (기본값: 2)
 *     pollInterval?: number,     // 상태 폴링 간격 ms (기본값: 10000)
 *     maxPollAttempts?: number   // 최대 폴링 횟수 (기본값: 60)
 *   }
 *
 * Response: Server-Sent Events stream
 *   - start: 배치 시작
 *   - job_start: 작업 시작
 *   - job_generating: 영상 생성 중
 *   - job_complete: 작업 완료
 *   - job_failed: 작업 실패
 *   - progress: 전체 진행률
 *   - complete: 배치 완료
 *   - error: 오류 발생
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] POST /api/batch/process - 요청 시작`);

  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    console.warn(`[${requestId}] API 키 누락`);
    return new Response(
      JSON.stringify({ error: 'API 키가 필요합니다.', code: 'MISSING_API_KEY' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: BatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: '잘못된 JSON 형식입니다.', code: 'INVALID_JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const {
    scripts,
    settings,
    concurrency = 2,
    pollInterval = 10000,
    maxPollAttempts = 60,
  } = body;

  // 요청 검증
  if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
    return new Response(
      JSON.stringify({ error: '스크립트 배열이 필요합니다.', code: 'MISSING_SCRIPTS' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!settings?.avatarId || !settings?.voiceId) {
    return new Response(
      JSON.stringify({ error: '아바타 ID와 음성 ID가 필요합니다.', code: 'MISSING_SETTINGS' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[${requestId}] 배치 처리 시작 - 총 ${scripts.length}개, 동시 처리: ${concurrency}`);

  // SSE 스트림 생성
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: SSEEventType, data: Record<string, unknown>) => {
        const event: SSEEvent = {
          type,
          data,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(encoder.encode(formatSSEEvent(event)));
      };

      try {
        const client = createHeyGenClient(apiKey);
        const batchId = crypto.randomUUID();

        // 배치 시작 이벤트
        sendEvent('start', {
          batchId,
          totalJobs: scripts.length,
          concurrency,
          settings: {
            avatarId: settings.avatarId,
            voiceId: settings.voiceId,
            aspectRatio: settings.aspectRatio || '16:9',
            testMode: settings.testMode || false,
          },
        });

        // 결과 추적
        const results: Array<{
          id: string;
          script: string;
          filename: string;
          status: 'completed' | 'failed';
          videoId?: string;
          videoUrl?: string;
          thumbnailUrl?: string;
          duration?: number;
          error?: string;
        }> = [];

        let completedCount = 0;
        let failedCount = 0;

        // 작업 처리 함수
        const processJob = async (scriptItem: ScriptItem) => {
          const jobId = scriptItem.id;
          const filename = scriptItem.filename || `video_${jobId}`;

          console.log(`[${requestId}] 작업 시작: ${jobId}`);
          sendEvent('job_start', { jobId, filename, script: scriptItem.script.substring(0, 100) });

          try {
            // 영상 생성 요청
            const videoRequest = buildVideoRequest(
              scriptItem.script,
              scriptItem.avatarId || settings.avatarId,
              scriptItem.voiceId || settings.voiceId,
              {
                aspectRatio: settings.aspectRatio || '16:9',
                testMode: settings.testMode || false,
                backgroundColor: settings.backgroundColor,
              }
            );

            const generateResponse = await client.generateVideo(videoRequest);
            const videoId = generateResponse.data.video_id;

            console.log(`[${requestId}] 작업 ${jobId}: videoId = ${videoId}`);
            sendEvent('job_generating', { jobId, videoId, filename });

            // 영상 완료 대기
            let attempts = 0;
            let videoUrl: string | undefined;
            let thumbnailUrl: string | undefined;
            let duration: number | undefined;

            while (attempts < maxPollAttempts) {
              await sleep(pollInterval);
              attempts++;

              const statusResponse = await client.getVideoStatus(videoId);
              const { status, video_url, thumbnail_url, duration: videoDuration, error } = statusResponse.data;

              if (status === 'completed' && video_url) {
                videoUrl = video_url;
                thumbnailUrl = thumbnail_url;
                duration = videoDuration;
                break;
              }

              if (status === 'failed') {
                throw new HeyGenApiError(
                  error || '영상 생성 실패',
                  'VIDEO_GENERATION_FAILED'
                );
              }

              // 진행 상황 업데이트 (10번에 한번)
              if (attempts % 10 === 0) {
                console.log(`[${requestId}] 작업 ${jobId}: 폴링 ${attempts}/${maxPollAttempts}`);
              }
            }

            if (!videoUrl) {
              throw new HeyGenApiError(
                `영상 생성 시간 초과 (${maxPollAttempts * pollInterval / 1000}초)`,
                'VIDEO_GENERATION_TIMEOUT'
              );
            }

            // 성공
            completedCount++;
            console.log(`[${requestId}] 작업 완료: ${jobId}`);
            sendEvent('job_complete', {
              jobId,
              videoId,
              videoUrl,
              thumbnailUrl,
              duration,
              filename,
            });

            results.push({
              id: jobId,
              script: scriptItem.script,
              filename,
              status: 'completed',
              videoId,
              videoUrl,
              thumbnailUrl,
              duration,
            });

          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            console.error(`[${requestId}] 작업 실패: ${jobId}`, error);

            sendEvent('job_failed', {
              jobId,
              filename,
              error: errorMessage,
            });

            results.push({
              id: jobId,
              script: scriptItem.script,
              filename,
              status: 'failed',
              error: errorMessage,
            });
          }

          // 진행률 업데이트
          const progress = ((completedCount + failedCount) / scripts.length) * 100;
          sendEvent('progress', {
            completed: completedCount,
            failed: failedCount,
            total: scripts.length,
            progress: Math.round(progress * 10) / 10,
          });
        };

        // 동시 처리로 작업 실행
        const runConcurrent = async () => {
          const queue = [...scripts];
          const activeJobs: Promise<void>[] = [];

          while (queue.length > 0 || activeJobs.length > 0) {
            // 빈 슬롯 채우기
            while (activeJobs.length < concurrency && queue.length > 0) {
              const scriptItem = queue.shift()!;
              const job = processJob(scriptItem).then(() => {
                const index = activeJobs.indexOf(job);
                if (index > -1) activeJobs.splice(index, 1);
              });
              activeJobs.push(job);
            }

            // 하나라도 완료될 때까지 대기
            if (activeJobs.length > 0) {
              await Promise.race(activeJobs);
            }
          }
        };

        await runConcurrent();

        // 배치 완료
        console.log(`[${requestId}] 배치 완료 - 성공: ${completedCount}, 실패: ${failedCount}`);
        sendEvent('complete', {
          batchId,
          summary: {
            total: scripts.length,
            completed: completedCount,
            failed: failedCount,
            successRate: Math.round((completedCount / scripts.length) * 100),
          },
          results,
        });

      } catch (error) {
        console.error(`[${requestId}] 배치 처리 오류:`, error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        sendEvent('error', {
          error: '배치 처리 중 오류가 발생했습니다.',
          detail: errorMessage,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-Id': requestId,
    },
  });
}
