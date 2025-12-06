import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface DownloadRequestBody {
  videoUrl: string;
  filename: string;
  outputDir?: string;
}

/**
 * 파일명을 안전하게 변환합니다.
 */
function sanitizeFilename(filename: string): string {
  // 확장자 분리
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);

  // 안전하지 않은 문자 제거
  const safeName = name
    .replace(/[<>:"/\\|?*]/g, '_')    // Windows 금지 문자
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')  // 제어 문자
    .replace(/\s+/g, '_')              // 공백을 밑줄로
    .replace(/_+/g, '_')               // 연속 밑줄 제거
    .replace(/^_|_$/g, '')             // 시작/끝 밑줄 제거
    .substring(0, 200);                // 최대 길이 제한

  return `${safeName || 'video'}${ext || '.mp4'}`;
}

/**
 * 파일이 이미 존재하는 경우 새 이름을 생성합니다.
 */
function getUniqueFilename(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);

  let counter = 0;
  let newFilename = filename;

  while (existsSync(path.join(dir, newFilename))) {
    counter++;
    newFilename = `${name}_${counter}${ext}`;
  }

  return newFilename;
}

/**
 * POST /api/batch/download
 * 완료된 영상을 다운로드하여 로컬에 저장합니다.
 *
 * Body:
 *   {
 *     videoUrl: string,     // 다운로드할 영상 URL
 *     filename: string,     // 저장할 파일명
 *     outputDir?: string    // 저장 디렉토리 (기본값: ./downloads)
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     filePath: string,     // 저장된 파일 경로
 *     fileSize: number,     // 파일 크기 (bytes)
 *     filename: string      // 실제 저장된 파일명
 *   }
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] POST /api/batch/download - 요청 시작`);

  let body: DownloadRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '잘못된 JSON 형식입니다.', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const { videoUrl, filename, outputDir = './downloads' } = body;

  // 요청 검증
  if (!videoUrl) {
    console.warn(`[${requestId}] 영상 URL 누락`);
    return NextResponse.json(
      { error: '영상 URL이 필요합니다.', code: 'MISSING_VIDEO_URL' },
      { status: 400 }
    );
  }

  if (!filename) {
    console.warn(`[${requestId}] 파일명 누락`);
    return NextResponse.json(
      { error: '파일명이 필요합니다.', code: 'MISSING_FILENAME' },
      { status: 400 }
    );
  }

  // URL 유효성 검사
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(videoUrl);
  } catch {
    console.warn(`[${requestId}] 잘못된 URL: ${videoUrl}`);
    return NextResponse.json(
      { error: '유효하지 않은 URL 형식입니다.', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  // 프로토콜 검사 (http/https만 허용)
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    console.warn(`[${requestId}] 허용되지 않은 프로토콜: ${parsedUrl.protocol}`);
    return NextResponse.json(
      { error: 'HTTP/HTTPS URL만 허용됩니다.', code: 'INVALID_PROTOCOL' },
      { status: 400 }
    );
  }

  try {
    // 출력 디렉토리 생성
    const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
    console.log(`[${requestId}] 출력 디렉토리: ${absoluteOutputDir}`);

    if (!existsSync(absoluteOutputDir)) {
      await mkdir(absoluteOutputDir, { recursive: true });
      console.log(`[${requestId}] 디렉토리 생성됨`);
    }

    // 파일명 정리 및 중복 처리
    const safeFilename = sanitizeFilename(filename);
    const uniqueFilename = getUniqueFilename(absoluteOutputDir, safeFilename);
    const filePath = path.join(absoluteOutputDir, uniqueFilename);

    console.log(`[${requestId}] 다운로드 시작: ${videoUrl}`);
    console.log(`[${requestId}] 저장 경로: ${filePath}`);

    // 영상 다운로드
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'HeyGen-Batch-Recorder/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`다운로드 실패: HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log(`[${requestId}] Content-Type: ${contentType}`);

    // 응답 본문을 버퍼로 읽기
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSize = buffer.length;

    console.log(`[${requestId}] 파일 크기: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // 파일 저장
    await writeFile(filePath, buffer);
    console.log(`[${requestId}] 파일 저장 완료: ${uniqueFilename}`);

    return NextResponse.json({
      success: true,
      filePath,
      filename: uniqueFilename,
      fileSize,
      fileSizeMB: Math.round((fileSize / 1024 / 1024) * 100) / 100,
    });

  } catch (error) {
    console.error(`[${requestId}] 다운로드 실패:`, error);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    // 네트워크 에러 구분
    if (error instanceof TypeError && errorMessage.includes('fetch')) {
      return NextResponse.json(
        {
          success: false,
          error: '네트워크 오류가 발생했습니다.',
          detail: errorMessage,
          code: 'NETWORK_ERROR',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: '영상 다운로드에 실패했습니다.',
        detail: errorMessage,
        code: 'DOWNLOAD_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/batch/download
 * 다운로드 디렉토리 정보를 반환합니다.
 */
export async function GET() {
  const outputDir = path.resolve(process.cwd(), './downloads');

  return NextResponse.json({
    success: true,
    outputDir,
    exists: existsSync(outputDir),
  });
}
