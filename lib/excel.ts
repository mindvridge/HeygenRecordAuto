// 엑셀 파싱 유틸리티

import * as XLSX from 'xlsx';
import { ExcelRow } from '@/types/heygen';

export interface ParseResult {
  success: boolean;
  data: ExcelRow[];
  error?: string;
  headers: string[];
}

// 엑셀 파일 파싱
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // JSON으로 변환 (header: 1 옵션으로 2차원 배열 형태로 반환)
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

        // 첫 번째 행을 헤더로 사용
        const headers = (jsonData[0] as string[]).map((h) => String(h).trim());

        // 데이터 행 파싱
        const rows: ExcelRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as string[];
          const rowObj: ExcelRow = { text: '' };

          headers.forEach((header, index) => {
            const value = row[index] !== undefined ? String(row[index]).trim() : '';
            rowObj[header] = value;

            // 'text' 또는 '텍스트' 컬럼을 메인 텍스트로 사용
            if (header.toLowerCase() === 'text' || header === '텍스트') {
              rowObj.text = value;
            }
          });

          // 텍스트가 있는 행만 추가
          if (rowObj.text) {
            rows.push(rowObj);
          }
        }

        if (rows.length === 0) {
          resolve({
            success: false,
            data: [],
            headers,
            error: "'text' 또는 '텍스트' 컬럼에 데이터가 없습니다.",
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

// 버퍼로부터 엑셀 파싱 (서버 사이드용)
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

    const headers = (jsonData[0] as string[]).map((h) => String(h).trim());
    const rows: ExcelRow[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as string[];
      const rowObj: ExcelRow = { text: '' };

      headers.forEach((header, index) => {
        const value = row[index] !== undefined ? String(row[index]).trim() : '';
        rowObj[header] = value;

        if (header.toLowerCase() === 'text' || header === '텍스트') {
          rowObj.text = value;
        }
      });

      if (rowObj.text) {
        rows.push(rowObj);
      }
    }

    return {
      success: true,
      data: rows,
      headers,
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

// 샘플 엑셀 데이터 생성
export function createSampleExcelData(): Blob {
  const ws = XLSX.utils.aoa_to_sheet([
    ['text'],
    ['안녕하세요, HeyGen 영상 자동화 테스트입니다.'],
    ['두 번째 영상의 텍스트입니다.'],
    ['세 번째 영상 스크립트입니다.'],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scripts');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
