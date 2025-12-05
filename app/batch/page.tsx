'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Video, ArrowLeft, Play, StopCircle, Download, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import FileUpload from '@/components/ui/FileUpload';
import JobList from '@/components/video/JobList';
import QueueStats from '@/components/video/QueueStats';
import { useQueueStore, useApiKeyStore, pollVideoStatus } from '@/lib/queue';
import { parseExcelFile, createSampleExcelData } from '@/lib/excel';
import { HeyGenAvatar, HeyGenVoice } from '@/types/heygen';

export default function BatchPage() {
  const { apiKey } = useApiKeyStore();
  const {
    jobs,
    config,
    isProcessing,
    setConfig,
    addJobs,
    updateJob,
    startProcessing,
    stopProcessing,
    resetQueue,
    getStats,
  } = useQueueStore();

  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [testMode, setTestMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // 아바타와 음성 목록 로드
  useEffect(() => {
    if (!apiKey) return;

    const loadData = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const [avatarsRes, voicesRes] = await Promise.all([
          fetch('/api/heygen/avatars', { headers: { 'x-api-key': apiKey } }),
          fetch('/api/heygen/voices', { headers: { 'x-api-key': apiKey } }),
        ]);

        if (avatarsRes.ok) {
          const data = await avatarsRes.json();
          setAvatars(data.data?.avatars || []);
        }

        if (voicesRes.ok) {
          const data = await voicesRes.json();
          setVoices(data.data?.voices || []);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setLoadError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [apiKey]);

  // 파일 처리
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError('');

    const result = await parseExcelFile(selectedFile);

    if (!result.success) {
      setParseError(result.error || '파일 파싱 실패');
      return;
    }

    // 설정 저장
    if (selectedAvatar && selectedVoice) {
      setConfig({
        avatarId: selectedAvatar,
        voiceId: selectedVoice,
        aspectRatio,
        testMode,
      });

      // 작업 추가
      const texts = result.data.map((row) => row.text);
      addJobs(texts);
    }
  };

  // 설정이 변경되면 config 업데이트
  useEffect(() => {
    if (selectedAvatar && selectedVoice) {
      setConfig({
        avatarId: selectedAvatar,
        voiceId: selectedVoice,
        aspectRatio,
        testMode,
      });
    }
  }, [selectedAvatar, selectedVoice, aspectRatio, testMode, setConfig]);

  // 처리 시작
  const handleStartProcessing = useCallback(async () => {
    if (!apiKey || !config || jobs.length === 0) return;

    startProcessing();

    for (const job of jobs) {
      if (!isProcessing) break;
      if (job.status !== 'pending') continue;

      updateJob(job.id, { status: 'processing' });

      try {
        // 영상 생성 요청
        const generateRes = await fetch('/api/heygen/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            text: job.text,
            avatarId: config.avatarId,
            voiceId: config.voiceId,
            aspectRatio: config.aspectRatio,
            testMode: config.testMode,
          }),
        });

        const generateData = await generateRes.json();

        if (!generateRes.ok || generateData.error) {
          updateJob(job.id, {
            status: 'failed',
            error: generateData.error || '영상 생성 요청 실패',
          });
          continue;
        }

        const videoId = generateData.data.video_id;
        updateJob(job.id, { videoId });

        // 영상 상태 폴링
        const result = await pollVideoStatus(
          videoId,
          apiKey,
          (status) => {
            console.log(`Video ${videoId} status: ${status}`);
          }
        );

        if (result.success) {
          updateJob(job.id, {
            status: 'completed',
            videoUrl: result.videoUrl,
          });
        } else {
          updateJob(job.id, {
            status: 'failed',
            error: result.error,
          });
        }
      } catch (error) {
        updateJob(job.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    stopProcessing();
  }, [apiKey, config, jobs, isProcessing, startProcessing, stopProcessing, updateJob]);

  // 샘플 파일 다운로드
  const handleDownloadSample = () => {
    const blob = createSampleExcelData();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_scripts.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 완료된 영상 일괄 다운로드
  const handleDownloadCompleted = () => {
    const completedJobs = jobs.filter((j) => j.status === 'completed' && j.videoUrl);
    completedJobs.forEach((job) => {
      if (job.videoUrl) {
        window.open(job.videoUrl, '_blank');
      }
    });
  };

  const stats = getStats();

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <p className="text-gray-600 mb-4">
              먼저 메인 페이지에서 HeyGen API 키를 설정해주세요.
            </p>
            <Link href="/">
              <Button>메인으로 이동</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <Video className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">대량 녹화</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleDownloadSample}>
                <Download className="h-4 w-4 mr-1" />
                샘플 파일
              </Button>
              <Button variant="ghost" size="sm" onClick={resetQueue}>
                <RefreshCw className="h-4 w-4 mr-1" />
                초기화
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Avatar Selection */}
            <Card>
              <CardHeader>
                <CardTitle>아바타 선택</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-gray-500">로딩 중...</p>
                ) : loadError ? (
                  <p className="text-red-500">{loadError}</p>
                ) : (
                  <Select
                    options={avatars.map((a) => ({
                      value: a.avatar_id,
                      label: a.avatar_name,
                    }))}
                    value={selectedAvatar}
                    onChange={(e) => setSelectedAvatar(e.target.value)}
                    placeholder="아바타를 선택하세요"
                  />
                )}
              </CardContent>
            </Card>

            {/* Voice Selection */}
            <Card>
              <CardHeader>
                <CardTitle>음성 선택</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-gray-500">로딩 중...</p>
                ) : (
                  <Select
                    options={voices.map((v) => ({
                      value: v.voice_id,
                      label: `${v.name} (${v.language})`,
                    }))}
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    placeholder="음성을 선택하세요"
                  />
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle>옵션</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="화면 비율"
                  options={[
                    { value: '16:9', label: '16:9 (가로)' },
                    { value: '9:16', label: '9:16 (세로)' },
                    { value: '1:1', label: '1:1 (정사각형)' },
                  ]}
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                />
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">테스트 모드 (크레딧 미사용)</span>
                </label>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>엑셀 파일 업로드</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  file={file}
                  onClear={() => {
                    setFile(null);
                    resetQueue();
                  }}
                />
                {parseError && (
                  <p className="mt-2 text-sm text-red-600">{parseError}</p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              {!isProcessing ? (
                <Button
                  onClick={handleStartProcessing}
                  disabled={!selectedAvatar || !selectedVoice || jobs.length === 0}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  녹화 시작
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={stopProcessing}
                  className="flex-1"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  중지
                </Button>
              )}
              {stats.completed > 0 && (
                <Button variant="secondary" onClick={handleDownloadCompleted}>
                  <Download className="h-4 w-4 mr-2" />
                  다운로드
                </Button>
              )}
            </div>
          </div>

          {/* Right Column - Jobs List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            {jobs.length > 0 && <QueueStats stats={stats} />}

            {/* Job List */}
            <Card>
              <CardHeader>
                <CardTitle>작업 목록 ({jobs.length}개)</CardTitle>
              </CardHeader>
              <CardContent>
                <JobList jobs={jobs} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
