// 엑셀 파싱 유틸리티

import * as XLSX from 'xlsx';
import {
  ExcelRow,
  ScriptItem,
  ValidationResult,
  ExcelParseOptions,
} from '@/types/heygen';

// HeyGen 스크립트 최대 글자수 제한
const HEYGEN_MAX_SCRIPT_LENGTH = 5000;

// 헤더 감지용 키워드
const HEADER_KEYWORDS = {
  id: ['id', 'no', '번호', '순번', 'number', 'seq', 'index'],
  script: ['script', 'text', '대사', '스크립트', '텍스트', 'content', '내용', 'dialogue'],
  filename: ['filename', 'file', '파일명', '파일', 'name', '이름', 'output'],
  avatarId: ['avatar', 'avatarid', 'avatar_id', '아바타', '아바타id'],
  voiceId: ['voice', 'voiceid', 'voice_id', '음성', '음성id'],
};

/**
 * 기존 ParseResult 인터페이스 (하위 호환성)
 */
export interface ParseResult {
  success: boolean;
  data: ExcelRow[];
  error?: string;
  headers: string[];
}

/**
 * ScriptItem 파싱 결과
 */
export interface ScriptParseResult {
  success: boolean;
  items: ScriptItem[];
  headers: string[];
  error?: string;
  detectedColumns: {
    id?: string;
    script?: string;
    filename?: string;
    avatarId?: string;
    voiceId?: string;
  };
}

/**
 * 헤더 행 자동 감지
 * 첫 번째로 스크립트 관련 키워드가 포함된 행을 헤더로 인식
 */
function detectHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const rowText = row.map((cell) => String(cell || '').toLowerCase()).join(' ');

    // 스크립트 관련 키워드가 있으면 헤더로 판단
    const hasScriptKeyword = HEADER_KEYWORDS.script.some((keyword) =>
      rowText.includes(keyword.toLowerCase())
    );

    if (hasScriptKeyword) {
      return i;
    }
  }

  // 기본값: 첫 번째 행을 헤더로 사용
  return 0;
}

/**
 * 컬럼 인덱스 찾기
 */
function findColumnIndex(headers: string[], keywords: string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const keyword of keywords) {
    const index = lowerHeaders.findIndex(
      (h) => h === keyword.toLowerCase() || h.includes(keyword.toLowerCase())
    );
    if (index !== -1) return index;
  }

  return -1;
}

/**
 * 행이 비어있는지 확인
 */
function isEmptyRow(row: unknown[]): boolean {
  if (!row || row.length === 0) return true;
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

/**
 * 셀 값을 문자열로 변환
 */
function getCellValue(row: unknown[], index: number): string {
  if (index < 0 || index >= row.length) return '';
  const value = row[index];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * 엑셀 파일을 ScriptItem[] 형태로 파싱
 */
export function parseExcelToScripts(
  file: File,
  options: ExcelParseOptions = {}
): Promise<ScriptParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 2차원 배열로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as unknown[][];

        if (jsonData.length === 0) {
          resolve({
            success: false,
            items: [],
            headers: [],
            detectedColumns: {},
            error: '엑셀 파일이 비어있습니다.',
          });
          return;
        }

        // 헤더 행 감지
        const headerRowIndex = options.headerRow ?? detectHeaderRow(jsonData);
        const headerRow = jsonData[headerRowIndex] as string[];
        const headers = headerRow.map((h) => String(h || '').trim());

        // 컬럼 인덱스 찾기
        const idColIndex = options.idColumn
          ? headers.indexOf(options.idColumn)
          : findColumnIndex(headers, HEADER_KEYWORDS.id);

        const scriptColIndex = options.scriptColumn
          ? headers.indexOf(options.scriptColumn)
          : findColumnIndex(headers, HEADER_KEYWORDS.script);

        const filenameColIndex = options.filenameColumn
          ? headers.indexOf(options.filenameColumn)
          : findColumnIndex(headers, HEADER_KEYWORDS.filename);

        const avatarIdColIndex = options.avatarIdColumn
          ? headers.indexOf(options.avatarIdColumn)
          : findColumnIndex(headers, HEADER_KEYWORDS.avatarId);

        const voiceIdColIndex = options.voiceIdColumn
          ? headers.indexOf(options.voiceIdColumn)
          : findColumnIndex(headers, HEADER_KEYWORDS.voiceId);

        // 스크립트 컬럼이 없으면 B열(인덱스 1)을 기본으로 사용
        const effectiveScriptCol = scriptColIndex !== -1 ? scriptColIndex : 1;

        // 데이터 행 파싱
        const items: ScriptItem[] = [];
        let autoId = 1;

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];

          // 빈 행 건너뛰기
          if (options.skipEmptyRows !== false && isEmptyRow(row)) {
            continue;
          }

          const script = getCellValue(row, effectiveScriptCol);

          // 스크립트가 비어있으면 건너뛰기
          if (!script) {
            continue;
          }

          // ID 추출 또는 자동 생성
          let id = getCellValue(row, idColIndex);
          if (!id) {
            id = String(autoId++);
          }

          const item: ScriptItem = {
            id,
            script,
            rowNumber: i + 1, // 엑셀 행 번호 (1부터 시작)
            filename: getCellValue(row, filenameColIndex) || undefined,
            avatarId: getCellValue(row, avatarIdColIndex) || options.defaultAvatarId || undefined,
            voiceId: getCellValue(row, voiceIdColIndex) || options.defaultVoiceId || undefined,
          };

          items.push(item);
        }

        if (items.length === 0) {
          resolve({
            success: false,
            items: [],
            headers,
            detectedColumns: {
              id: idColIndex !== -1 ? headers[idColIndex] : undefined,
              script: scriptColIndex !== -1 ? headers[scriptColIndex] : undefined,
              filename: filenameColIndex !== -1 ? headers[filenameColIndex] : undefined,
              avatarId: avatarIdColIndex !== -1 ? headers[avatarIdColIndex] : undefined,
              voiceId: voiceIdColIndex !== -1 ? headers[voiceIdColIndex] : undefined,
            },
            error: '스크립트 데이터가 없습니다. 엑셀 파일에 대사 컬럼이 있는지 확인해주세요.',
          });
          return;
        }

        resolve({
          success: true,
          items,
          headers,
          detectedColumns: {
            id: idColIndex !== -1 ? headers[idColIndex] : undefined,
            script: effectiveScriptCol < headers.length ? headers[effectiveScriptCol] : 'B열',
            filename: filenameColIndex !== -1 ? headers[filenameColIndex] : undefined,
            avatarId: avatarIdColIndex !== -1 ? headers[avatarIdColIndex] : undefined,
            voiceId: voiceIdColIndex !== -1 ? headers[voiceIdColIndex] : undefined,
          },
        });
      } catch (error) {
        resolve({
          success: false,
          items: [],
          headers: [],
          detectedColumns: {},
          error: `엑셀 파일 파싱 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        items: [],
        headers: [],
        detectedColumns: {},
        error: '파일을 읽는 중 오류가 발생했습니다.',
      });
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * ScriptItem 데이터 유효성 검사
 */
export function validateExcelData(
  items: ScriptItem[],
  options: { maxScriptLength?: number } = {}
): ValidationResult {
  const maxLength = options.maxScriptLength ?? HEYGEN_MAX_SCRIPT_LENGTH;

  const validItems: ScriptItem[] = [];
  const invalidItems: Array<{ item: ScriptItem; errors: string[] }> = [];
  const warnings: string[] = [];
  let emptyCount = 0;

  for (const item of items) {
    const errors: string[] = [];

    // 스크립트가 비어있는지 확인
    if (!item.script || item.script.trim() === '') {
      emptyCount++;
      continue; // 빈 항목은 건너뛰기
    }

    // 최대 글자수 체크
    if (item.script.length > maxLength) {
      errors.push(
        `스크립트가 너무 깁니다 (${item.script.length}자). 최대 ${maxLength}자까지 가능합니다.`
      );
    }

    // 특수문자 경고 (HeyGen에서 문제가 될 수 있는 문자)
    const problematicChars = item.script.match(/[<>{}[\]\\]/g);
    if (problematicChars) {
      const uniqueChars = Array.from(new Set(problematicChars));
      warnings.push(
        `행 ${item.rowNumber}: 특수문자 (${uniqueChars.join(', ')})가 포함되어 있습니다. 영상 생성에 문제가 있을 수 있습니다.`
      );
    }

    // 너무 짧은 스크립트 경고
    if (item.script.length < 5) {
      warnings.push(`행 ${item.rowNumber}: 스크립트가 너무 짧습니다 (${item.script.length}자).`);
    }

    if (errors.length > 0) {
      invalidItems.push({ item, errors });
    } else {
      validItems.push(item);
    }
  }

  return {
    isValid: invalidItems.length === 0 && validItems.length > 0,
    validItems,
    invalidItems,
    warnings,
    summary: {
      total: items.length,
      valid: validItems.length,
      invalid: invalidItems.length,
      empty: emptyCount,
    },
  };
}

/**
 * 기존 엑셀 파일 파싱 함수 (하위 호환성 유지)
 */
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as unknown[][];

        if (jsonData.length === 0) {
          resolve({
            success: false,
            data: [],
            headers: [],
            error: '엑셀 파일이 비어있습니다.',
          });
          return;
        }

        // 헤더 행 자동 감지
        const headerRowIndex = detectHeaderRow(jsonData);
        const headers = (jsonData[headerRowIndex] as string[]).map((h) => String(h).trim());

        // 스크립트 컬럼 찾기
        const scriptColIndex = findColumnIndex(headers, HEADER_KEYWORDS.script);
        const effectiveScriptCol = scriptColIndex !== -1 ? scriptColIndex : 1;

        const rows: ExcelRow[] = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (isEmptyRow(row)) continue;

          const rowObj: ExcelRow = { text: '' };

          headers.forEach((header, index) => {
            const value = getCellValue(row, index);
            rowObj[header] = value;
          });

          // text 필드 설정
          rowObj.text = getCellValue(row, effectiveScriptCol);

          if (rowObj.text) {
            rows.push(rowObj);
          }
        }

        if (rows.length === 0) {
          resolve({
            success: false,
            data: [],
            headers,
            error: '스크립트 데이터가 없습니다.',
          });
          return;
        }

        resolve({
          success: true,
          data: rows,
          headers,
        });
      } catch (error) {
        resolve({
          success: false,
          data: [],
          headers: [],
          error: `엑셀 파일 파싱 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        headers: [],
        error: '파일을 읽는 중 오류가 발생했습니다.',
      });
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * 버퍼로부터 ScriptItem[] 파싱 (서버 사이드용)
 */
export function parseExcelBufferToScripts(
  buffer: Buffer,
  options: ExcelParseOptions = {}
): ScriptParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    if (jsonData.length === 0) {
      return {
        success: false,
        items: [],
        headers: [],
        detectedColumns: {},
        error: '엑셀 파일이 비어있습니다.',
      };
    }

    const headerRowIndex = options.headerRow ?? detectHeaderRow(jsonData);
    const headerRow = jsonData[headerRowIndex] as string[];
    const headers = headerRow.map((h) => String(h || '').trim());

    const idColIndex = findColumnIndex(headers, HEADER_KEYWORDS.id);
    const scriptColIndex = findColumnIndex(headers, HEADER_KEYWORDS.script);
    const filenameColIndex = findColumnIndex(headers, HEADER_KEYWORDS.filename);
    const avatarIdColIndex = findColumnIndex(headers, HEADER_KEYWORDS.avatarId);
    const voiceIdColIndex = findColumnIndex(headers, HEADER_KEYWORDS.voiceId);

    const effectiveScriptCol = scriptColIndex !== -1 ? scriptColIndex : 1;

    const items: ScriptItem[] = [];
    let autoId = 1;

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];

      if (options.skipEmptyRows !== false && isEmptyRow(row)) {
        continue;
      }

      const script = getCellValue(row, effectiveScriptCol);
      if (!script) continue;

      let id = getCellValue(row, idColIndex);
      if (!id) id = String(autoId++);

      items.push({
        id,
        script,
        rowNumber: i + 1,
        filename: getCellValue(row, filenameColIndex) || undefined,
        avatarId: getCellValue(row, avatarIdColIndex) || options.defaultAvatarId || undefined,
        voiceId: getCellValue(row, voiceIdColIndex) || options.defaultVoiceId || undefined,
      });
    }

    return {
      success: items.length > 0,
      items,
      headers,
      detectedColumns: {
        id: idColIndex !== -1 ? headers[idColIndex] : undefined,
        script: effectiveScriptCol < headers.length ? headers[effectiveScriptCol] : 'B열',
        filename: filenameColIndex !== -1 ? headers[filenameColIndex] : undefined,
        avatarId: avatarIdColIndex !== -1 ? headers[avatarIdColIndex] : undefined,
        voiceId: voiceIdColIndex !== -1 ? headers[voiceIdColIndex] : undefined,
      },
      error: items.length === 0 ? '스크립트 데이터가 없습니다.' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      items: [],
      headers: [],
      detectedColumns: {},
      error: `엑셀 파일 파싱 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * 버퍼로부터 엑셀 파싱 (서버 사이드용, 하위 호환)
 */
export function parseExcelBuffer(buffer: Buffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    if (jsonData.length === 0) {
      return {
        success: false,
        data: [],
        headers: [],
        error: '엑셀 파일이 비어있습니다.',
      };
    }

    const headerRowIndex = detectHeaderRow(jsonData);
    const headers = (jsonData[headerRowIndex] as string[]).map((h) => String(h).trim());
    const scriptColIndex = findColumnIndex(headers, HEADER_KEYWORDS.script);
    const effectiveScriptCol = scriptColIndex !== -1 ? scriptColIndex : 1;

    const rows: ExcelRow[] = [];

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];
      if (isEmptyRow(row)) continue;

      const rowObj: ExcelRow = { text: '' };

      headers.forEach((header, index) => {
        rowObj[header] = getCellValue(row, index);
      });

      rowObj.text = getCellValue(row, effectiveScriptCol);

      if (rowObj.text) {
        rows.push(rowObj);
      }
    }

    return {
      success: rows.length > 0,
      data: rows,
      headers,
      error: rows.length === 0 ? '스크립트 데이터가 없습니다.' : undefined,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      headers: [],
      error: `엑셀 파일 파싱 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * 샘플 엑셀 데이터 생성 (확장 버전)
 */
export function createSampleExcelData(includeAllColumns: boolean = false): Blob {
  const data = includeAllColumns
    ? [
        ['번호', '대사', '파일명', '아바타ID', '음성ID'],
        ['1', '안녕하세요, HeyGen 영상 자동화 테스트입니다.', 'video_001', '', ''],
        ['2', '두 번째 영상의 대사입니다.', 'video_002', '', ''],
        ['3', '세 번째 영상 스크립트입니다.', 'video_003', '', ''],
      ]
    : [
        ['번호', '대사'],
        ['1', '안녕하세요, HeyGen 영상 자동화 테스트입니다.'],
        ['2', '두 번째 영상의 대사입니다.'],
        ['3', '세 번째 영상 스크립트입니다.'],
      ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 컬럼 너비 설정
  ws['!cols'] = includeAllColumns
    ? [{ wch: 8 }, { wch: 50 }, { wch: 15 }, { wch: 20 }, { wch: 20 }]
    : [{ wch: 8 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scripts');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * ScriptItem을 ExcelRow로 변환 (하위 호환성)
 */
export function scriptItemsToExcelRows(items: ScriptItem[]): ExcelRow[] {
  return items.map((item) => ({
    text: item.script,
    id: item.id,
    filename: item.filename || '',
    avatarId: item.avatarId || '',
    voiceId: item.voiceId || '',
  }));
}

/**
 * 텍스트 배열 추출 (배치 처리용)
 */
export function extractScripts(items: ScriptItem[]): string[] {
  return items.map((item) => item.script);
}
