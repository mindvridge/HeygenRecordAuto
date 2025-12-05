'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Video, FileSpreadsheet, Settings, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useApiKeyStore } from '@/lib/queue';

export default function Home() {
  const { apiKey, setApiKey } = useApiKeyStore();
  const [inputKey, setInputKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState('');

  const validateApiKey = useCallback(async (key: string) => {
    if (!key) return;

    setIsValidating(true);
    setError('');

    try {
      const response = await fetch('/api/heygen/credits', {
        headers: {
          'x-api-key': key,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCredits(data.data.credits);
        setApiKey(key);
      } else {
        setError('유효하지 않은 API 키입니다.');
        setCredits(null);
      }
    } catch {
      setError('API 연결에 실패했습니다.');
      setCredits(null);
    } finally {
      setIsValidating(false);
    }
  }, [setApiKey]);

  useEffect(() => {
    setInputKey(apiKey);
    if (apiKey) {
      validateApiKey(apiKey);
    }
  }, [apiKey, validateApiKey]);

  const handleSaveApiKey = () => {
    validateApiKey(inputKey);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Video className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">HeyGen Batch Recorder</h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link href="/batch" className="text-gray-600 hover:text-gray-900">
                대량 녹화
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* API Key Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2 text-gray-500" />
              HeyGen API 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <Input
                  label="API Key"
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="HeyGen API 키를 입력하세요"
                />
              </div>
              <Button onClick={handleSaveApiKey} isLoading={isValidating}>
                저장
              </Button>
            </div>

            {/* Status */}
            <div className="mt-4">
              {credits !== null && (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span>연결됨 - 남은 크레딧: {credits}</span>
                </div>
              )}
              {error && (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-xl transition-shadow cursor-pointer">
            <Link href="/batch">
              <CardContent className="flex items-center space-x-4 py-8">
                <div className="p-4 bg-blue-100 rounded-full">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">대량 녹화</h3>
                  <p className="text-gray-500">엑셀 파일을 업로드하여 여러 영상을 한 번에 생성합니다</p>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-xl transition-shadow">
            <CardContent className="flex items-center space-x-4 py-8">
              <div className="p-4 bg-gray-100 rounded-full">
                <Settings className="h-8 w-8 text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">설정</h3>
                <p className="text-gray-500">API 설정 및 기본 옵션을 관리합니다</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>사용 방법</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3 text-gray-600">
              <li>HeyGen API 키를 입력하고 저장합니다.</li>
              <li>&quot;대량 녹화&quot; 메뉴로 이동합니다.</li>
              <li>사용할 아바타와 음성을 선택합니다.</li>
              <li>녹화할 텍스트가 담긴 엑셀 파일(.xlsx)을 업로드합니다.
                <ul className="list-disc list-inside ml-4 mt-1 text-sm">
                  <li>첫 번째 행은 헤더로, &quot;text&quot; 또는 &quot;텍스트&quot; 컬럼이 필요합니다.</li>
                  <li>각 행의 텍스트가 개별 영상으로 생성됩니다.</li>
                </ul>
              </li>
              <li>&quot;녹화 시작&quot; 버튼을 클릭하여 일괄 처리를 시작합니다.</li>
              <li>각 영상의 처리 상태를 실시간으로 확인할 수 있습니다.</li>
            </ol>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            HeyGen Batch Recorder - 아바타 영상 대량 녹화 자동화
          </p>
        </div>
      </footer>
    </div>
  );
}
