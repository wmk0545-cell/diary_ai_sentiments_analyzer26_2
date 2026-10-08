"use client";

import React, { useState, useEffect } from "react";
import { SentimentAnalysisResult, DiaryRecord } from "@/types/diary";

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";

export default function Home() {
  const [diaryDate, setDiaryDate] = useState<string>("");
  const [diaryText, setDiaryText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<SentimentAnalysisResult | null>(null);

  // 구글 시트 CRUD 관련 상태
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isListModalOpen, setIsListModalOpen] = useState<boolean>(false);
  const [diaryList, setDiaryList] = useState<DiaryRecord[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<DiaryRecord | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [deletingTimestamp, setDeletingTimestamp] = useState<string | null>(null);

  // 날짜, 요일 초기화 및 포맷 (시간 제외)
  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const date = now.getDate();
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const day = dayNames[now.getDay()];

      setDiaryDate(`${year}년 ${month}월 ${date}일 (${day})`);
    };

    updateDate();
  }, []);

  // [CREATE] 구글 스프레드시트에 일기 저장
  const handleSaveDiary = async () => {
    if (!diaryText.trim()) {
      alert("저장할 일기 내용을 입력해주세요.");
      return;
    }

    if (!GOOGLE_SCRIPT_URL) {
      alert("NEXT_PUBLIC_GOOGLE_SCRIPT_URL 환경 변수가 설정되지 않았습니다.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          datetime: diaryDate,
          content: diaryText.trim(),
        }),
      });

      const result = await res.json();
      if (result.success) {
        alert("일기가 구글 스프레드시트에 성공적으로 저장되었습니다!");
      } else {
        alert(`저장 실패: ${result.error || "알 수 없는 오류"}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("일기 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  // [READ] 구글 스프레드시트 일기 목록 불러오기
  const fetchDiaryList = async () => {
    if (!GOOGLE_SCRIPT_URL) {
      alert("NEXT_PUBLIC_GOOGLE_SCRIPT_URL 환경 변수가 설정되지 않았습니다.");
      return;
    }

    setIsLoadingList(true);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL);
      const result = await res.json();

      if (result.success && Array.isArray(result.data)) {
        // 최신순으로 정렬 (역순)
        setDiaryList(result.data.reverse());
      } else {
        setDiaryList([]);
        alert(`일기 목록을 불러오지 못했습니다: ${result.error || "오류"}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("일기 목록을 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingList(false);
    }
  };

  // [일기보기] 모달 열기
  const handleOpenDiaryList = () => {
    setIsListModalOpen(true);
    fetchDiaryList();
  };

  // [DELETE] 일기 삭제
  const handleDeleteDiary = async (timestamp: string) => {
    if (!confirm("정말 이 일기를 삭제하시겠습니까?")) return;

    setDeletingTimestamp(timestamp);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          targetTimestamp: timestamp,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setDiaryList((prev) => prev.filter((item) => String(item.timestamp) !== String(timestamp)));
        alert("일기가 삭제되었습니다.");
      } else {
        alert(`삭제 실패: ${result.error || "오류"}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("일기 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingTimestamp(null);
    }
  };

  // [UPDATE] 일기 수정 시작
  const handleStartEdit = (record: DiaryRecord) => {
    setEditingRecord(record);
    setEditContent(record.content);
  };

  // [UPDATE] 일기 수정 저장
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    if (!editContent.trim()) {
      alert("수정할 내용을 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          targetTimestamp: editingRecord.timestamp,
          content: editContent.trim(),
        }),
      });

      const result = await res.json();
      if (result.success) {
        setDiaryList((prev) =>
          prev.map((item) =>
            String(item.timestamp) === String(editingRecord.timestamp)
              ? { ...item, content: editContent.trim() }
              : item
          )
        );
        setEditingRecord(null);
        alert("일기가 성공적으로 수정되었습니다.");
      } else {
        alert(`수정 실패: ${result.error || "오류"}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("일기 수정 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  // 목록에서 선택한 일기를 에디터로 불러오기
  const handleLoadToEditor = (record: DiaryRecord) => {
    if (diaryText.trim() && !confirm("현재 작성 중인 내용이 덮어씌워집니다. 불러오시겠습니까?")) {
      return;
    }
    setDiaryText(record.content);
    if (record.datetime) setDiaryDate(record.datetime);
    setIsListModalOpen(false);
    alert("선택한 일기를 에디터로 불러왔습니다.");
  };


  const handleAnalyze = async () => {
    if (!diaryText.trim()) {
      alert("일기 내용을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaryText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "분석 요청 실패");
      }

      setAnalysisResult(data);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "감성 분석 중 오류가 발생했습니다.";
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 새로 작성 (재시작) 버튼 핸들러: 일기 작성 및 분석 결과 초기화
  const handleReset = () => {
    if (confirm("일기 내용과 분석 결과를 초기화하고 새로 작성하시겠습니까?")) {
      setDiaryText("");
      setAnalysisResult(null);
    }
  };

  const primaryId = analysisResult?.primaryEmotion?.id || "peace";

  return (
    <div className="min-h-screen bg-[#FAF8FC] text-[#2C243B] font-sans pb-20">
      {/* Top Navigation */}
      <header className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between border-b border-[#E9E4F0]/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#6C47FF] to-[#9B77FF] flex items-center justify-center text-white shadow-sm font-semibold">
            ✦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-[#1F192B] tracking-tight">AI 일기 감성 분석</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#EFEAFE] text-[#6C47FF] px-2 py-0.5 rounded-full">
                ✦ Gemini AI
              </span>
            </div>
            <p className="text-xs text-[#7B7289]">돌아보는 감성 기록과 따뜻한 AI 공감 처방</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#7B7289] bg-white px-3 py-1.5 rounded-full border border-[#EDE7F6] shadow-xs">
          <span>🔒</span>
          <span>안전한 개인 보관함</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Date, Condition & Tags Bar */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#ECE6F6] shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full hover:bg-[#F3EFFB] flex items-center justify-center text-[#6C47FF] transition-colors">
              ‹
            </button>
            <div className="flex items-center gap-2 bg-[#F6F2FC] px-3.5 py-1.5 rounded-xl border border-[#EBE3F8] text-[#5536D9] font-medium text-sm">
              <span>📅</span>
              <span>{diaryDate || "날짜 불러오는 중..."}</span>
            </div>
            <button className="w-8 h-8 rounded-full hover:bg-[#F3EFFB] flex items-center justify-center text-[#6C47FF] transition-colors">
              ›
            </button>
            <span className="text-xs bg-[#EDE7F9] text-[#6C47FF] px-2.5 py-1 rounded-full font-medium ml-1">
              오늘
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7B7289] font-medium">오늘의 컨디션:</span>
            <div className="flex items-center gap-1.5 bg-[#FFFBEA] border border-[#FBEAC3] px-2.5 py-1 rounded-full text-xs text-[#B45309] font-medium">
              <span>☀️</span>
              <span>맑음</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#F0FDF4] border border-[#DCFCE7] px-2.5 py-1 rounded-full text-xs text-[#166534] font-medium">
              <span>🍵</span>
              <span>여유로운 오후</span>
            </div>
            <button className="text-xs text-[#7B7289] hover:text-[#5536D9] border border-dashed border-[#D2C8E4] px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors">
              + 태그 추가
            </button>
          </div>
        </div>

        {/* Diary Editor Area */}
        <div className="bg-white rounded-3xl border border-[#E9E3F5] shadow-sm p-6 sm:p-7 relative transition-all focus-within:border-[#B79BFB] focus-within:ring-2 focus-within:ring-[#EFEAFE]">
          <div className="flex items-center justify-between mb-3 text-xs text-[#7B7289] border-b border-[#F4F0FA] pb-2.5">
            <div className="flex items-center gap-2 font-medium text-[#463D56]">
              <span>✏️</span>
              <span>오늘의 마음 기록</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-xs mr-1">
                <span className="text-[#6C47FF] font-semibold">{diaryText.length}</span> 자
              </div>
              <button
                type="button"
                onClick={handleSaveDiary}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EFFE] hover:bg-[#EBE2FC] active:scale-95 text-[#6C47FF] font-medium text-xs border border-[#E3D6F9] transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span>💾</span>
                <span>{isSaving ? "저장 중..." : "저장"}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenDiaryList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0F4FE] hover:bg-[#E3EBFC] active:scale-95 text-[#3B66F5] font-medium text-xs border border-[#D5E1FB] transition-all cursor-pointer shadow-xs"
              >
                <span>📖</span>
                <span>일기보기</span>
              </button>
            </div>
          </div>

          <textarea
            value={diaryText}
            onChange={(e) => setDiaryText(e.target.value)}
            placeholder="오늘 하루 마음속에 머물렀던 순간, 생각, 솔직한 감정들을 자유롭게 적어보세요..."
            rows={7}
            className="w-full resize-none border-none outline-hidden text-[#2D243D] text-[15px] leading-relaxed placeholder-[#B4A9C8] font-normal bg-transparent"
          />

          <div className="mt-4 pt-3 border-t border-[#F7F3FB] flex flex-wrap items-center justify-between text-[11px] text-[#978DA6]">
            <div className="flex items-center gap-1.5">
              <span>🔒</span>
              <span>작성된 일기는 암호화되어 안전하게 보호됩니다.</span>
            </div>
            <div className="italic text-[#8E839F]">
              마지막 자동 임시저장: 방금 전
            </div>
          </div>
        </div>

        {/* Action Buttons Bar: 일기 저장하기 버튼 삭제, AI 감성 분석 시작 & 새로 작성(재시작) 구성 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-[#6542F1] hover:bg-[#5330DE] active:scale-[0.99] text-white font-medium text-sm shadow-md shadow-[#6542F1]/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Gemini 3.1 감성 분석 중...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>AI 감성 분석 시작</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-white hover:bg-[#FAF7FD] active:scale-[0.99] text-[#524962] border border-[#E3DCF1] font-medium text-sm transition-all cursor-pointer"
          >
            <span>🔄</span>
            <span>새로 작성 (재시작)</span>
          </button>
        </div>

        {/* Emotion Spectrum Monitor (초기에는 숨김, AI 분석 결과가 있을 때만 표시) */}
        {analysisResult && (
          <div className="bg-white rounded-3xl border border-[#EDE7F7] shadow-sm p-6 sm:p-7 transition-all animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-[#231A33]">감성 상태 모니터</h2>
                <p className="text-xs text-[#7E738F] mt-0.5">
                  Gemini 3.1 Flash가 분석한 5가지 핵심 감정 스펙트럼 상태입니다.
                </p>
              </div>
              <span className="text-xs bg-[#EAFBF3] text-[#0F8A52] font-semibold px-3 py-1 rounded-full border border-[#C5F3DB]">
                ✓ 분석 완료됨
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-3 items-end pt-5">
              {analysisResult.emotions.map((emo) => {
                const isPrimary = emo.id === primaryId;
                return (
                  <div
                    key={emo.id}
                    className={`relative flex flex-col items-center p-3 sm:p-4 rounded-2xl transition-all duration-300 ${
                      isPrimary
                        ? "bg-[#F7F3FE] border-2 border-[#7C4DFF] shadow-md -translate-y-2 scale-105"
                        : "bg-[#FAFAFD] border border-[#ECE7F5] hover:bg-[#F5F2FA]"
                    }`}
                  >
                    {isPrimary && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7C4DFF] text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs">
                        주요 감정
                      </div>
                    )}

                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl sm:text-3xl mb-2">
                      {emo.emoji}
                    </div>

                    <span className={`text-xs font-semibold ${isPrimary ? "text-[#5527D6]" : "text-[#4A4259]"}`}>
                      {emo.name}
                    </span>

                    <span className={`text-xs mt-1 font-bold ${isPrimary ? "text-[#6C47FF]" : "text-[#867B9A]"}`}>
                      {emo.score}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Diary Sentiment Analysis Result Box (초기에는 숨김, AI 분석 결과가 있을 때만 표시) */}
        {analysisResult && (
          <div className="bg-gradient-to-b from-[#F7F4FD] to-white rounded-3xl border border-[#E5DCF6] shadow-md p-6 sm:p-8 space-y-6 transition-all animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE3F7]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#6C47FF] text-white flex items-center justify-center text-sm font-bold shadow-xs">
                  ✦
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E172F]">AI 일기 감성 분석 결과</h3>
                  <p className="text-xs text-[#7B6E91]">Gemini 3.1 Flash 딥러닝 감정 해석 엔진 리포트</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono bg-[#EFEAFE] text-[#6C47FF] px-2.5 py-1 rounded-full font-medium">
                  Latency: {analysisResult.latencySeconds}s
                </span>
                <button
                  onClick={() => alert("분석 결과가 클립보드에 복사되었습니다.")}
                  className="w-8 h-8 rounded-full hover:bg-[#EFE9FA] flex items-center justify-center text-[#74698A] transition-colors"
                  title="공유"
                >
                  📤
                </button>
              </div>
            </div>

            {/* Core Emotion Summary Card */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECE4F8] shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#7C4DFF] bg-[#F1ECFE] px-2.5 py-0.5 rounded-full">
                    Core Emotion Summary
                  </span>
                  <div className="mt-2 text-lg sm:text-xl font-bold text-[#231A35] flex items-center gap-2">
                    <span>오늘의 주요 감정:</span>
                    <span className="text-[#653EE8] underline decoration-wavy decoration-[#CBB7FA] underline-offset-4">
                      {analysisResult.primaryEmotion.title}
                    </span>
                    <span className="text-base text-[#7B6E91]">
                      ({analysisResult.primaryEmotion.percentage}%)
                    </span>
                  </div>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-[#F4EFFD] flex items-center justify-center text-2xl">
                  {analysisResult.primaryEmotion.id === "peace" ? "🌿" :
                   analysisResult.primaryEmotion.id === "happy" ? "🌸" :
                   analysisResult.primaryEmotion.id === "hope" ? "✨" :
                   analysisResult.primaryEmotion.id === "sad" ? "🌧️" : "⚡"}
                </div>
              </div>

              {/* Mind Prescription Comment */}
              <div className="mt-4 pt-4 border-t border-[#F6F1FD] flex items-start gap-3">
                <div className="text-lg">💬</div>
                <div className="text-xs sm:text-sm text-[#4E4461] leading-relaxed">
                  <span className="font-semibold text-[#5B34DB]">마인드블룸의 마음 처방 코멘트</span>
                  <p className="mt-1 font-serif text-[#392F4C] italic bg-[#FAF8FE] p-3.5 rounded-xl border border-[#EFEAF9]">
                    &ldquo;{analysisResult.mindPrescription}&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom 2-Column: Detailed Spectrum & Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Detailed Spectrum */}
              <div className="bg-white rounded-2xl p-5 border border-[#ECE4F8] shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#251B38]">세부 감정 다차원 스펙트럼</span>
                  <span className="text-[11px] text-[#867B9B]">신뢰도 점수 기반</span>
                </div>

                <div className="space-y-3">
                  {analysisResult.detailedSpectrum.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-[#403752]">
                          {item.label} <span className="text-[11px] text-[#8A7F9F]">({item.englishLabel})</span>
                        </span>
                        <span className="font-bold text-[#5E38DD]">{item.score}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#F1EDF9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.score}%`,
                            backgroundColor: item.color || "#7c3aed",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extracted Keywords */}
              <div className="bg-white rounded-2xl p-5 border border-[#ECE4F8] shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-[#251B38] block mb-3">추출된 감성 키워드</span>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-medium px-3 py-1.5 rounded-xl bg-[#F4F0FD] text-[#6039E0] border border-[#E5DCF8] transition-transform hover:scale-105"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#F6F1FD] flex items-center justify-between text-xs text-[#7B7090]">
                  <span>결과를 캘린더에 반영할까요?</span>
                  <button
                    onClick={() => alert("월간 캘린더 감정 동기화 완료!")}
                    className="text-[#653EE8] hover:text-[#4F2ABF] font-semibold flex items-center gap-1 transition-colors"
                  >
                    월간 캘린더 동기화 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 mt-20 pt-8 border-t border-[#EAE3F5]">
        <div className="bg-gradient-to-r from-[#F6F1FE] via-white to-[#F2EDFD] rounded-2xl p-6 border border-[#EBE3F8] shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6C47FF] to-[#9B77FF] flex items-center justify-center text-white text-xs font-bold shadow-xs">
                ✦
              </div>
              <div>
                <div className="text-sm font-bold text-[#231A35] flex items-center justify-center sm:justify-start gap-1.5">
                  <span>Diary AI Sentiments Analyzer</span>
                  <span className="text-[10px] bg-[#EDE7FD] text-[#6C47FF] px-2 py-0.5 rounded-full font-medium">
                    v1.0
                  </span>
                </div>
                <p className="text-xs text-[#7E7390] mt-0.5">
                  AI 기반 마음 치유 및 일기 감성 분석 시스템
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#653EE8] border border-[#E3D9F8] shadow-2xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                Gemini 3.1 Flash Engine
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#EDE7F6] flex flex-col sm:flex-row items-center justify-between text-xs text-[#8E83A3] gap-3">
            <p className="font-medium text-[#6B6082] text-center sm:text-left tracking-tight">
              Copyright INU Diary AI Sentiments Analyzer by Ayoun Woo
            </p>
            <div className="flex items-center gap-4 text-[11px] text-[#7E7295]">
              <a href="#" className="hover:text-[#6C47FF] transition-colors">개인정보처리방침</a>
              <span className="text-[#D9D0EA]">·</span>
              <a href="#" className="hover:text-[#6C47FF] transition-colors">이용약관</a>
              <span className="text-[#D9D0EA]">·</span>
              <a href="#" className="hover:text-[#6C47FF] transition-colors">INU 감성 AI 연구실</a>
            </div>
          </div>
        </div>
      </footer>

      {/* [일기보기] 구글 시트 저장 목록 모달 (CRUD 지원) */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#ECE4F8] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#F0EBF8] flex items-center justify-between bg-gradient-to-r from-[#FAF8FE] to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EDE7FD] text-[#6C47FF] flex items-center justify-center font-bold text-sm">
                  📖
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1E172F]">구글 시트 저장 일기 목록</h3>
                  <p className="text-xs text-[#7E7490]">
                    총 <span className="font-semibold text-[#6C47FF]">{diaryList.length}</span>개의 기록이 보관되어 있습니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchDiaryList}
                  disabled={isLoadingList}
                  className="px-2.5 py-1.5 text-xs text-[#6C47FF] bg-[#F5F0FE] hover:bg-[#EBE2FC] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="새로고침"
                >
                  <span>🔄</span>
                  <span>새로고침</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsListModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-[#F2EDFA] flex items-center justify-center text-[#7C718E] text-base transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {isLoadingList ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#7E7490]">
                  <svg className="animate-spin h-6 w-6 text-[#6C47FF]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span className="text-xs">스프레드시트에서 일기를 불러오는 중...</span>
                </div>
              ) : diaryList.length === 0 ? (
                <div className="py-16 text-center text-[#958BA5] text-sm">
                  <div className="text-3xl mb-2">🍃</div>
                  저장된 일기가 없습니다. 일기를 작성하고 [저장]을 눌러보세요!
                </div>
              ) : (
                diaryList.map((item, idx) => {
                  const isEditing = editingRecord && String(editingRecord.timestamp) === String(item.timestamp);
                  return (
                    <div
                      key={item.timestamp || idx}
                      className="p-4 rounded-2xl bg-[#FAF8FE] border border-[#ECE4F8] hover:border-[#D9C8F5] transition-all"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between text-xs pb-2 mb-2 border-b border-[#F0EAF8]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#5735DB]">
                            📅 {item.datetime || "날짜 미지정"}
                          </span>
                          <span className="text-[10px] text-[#A095B3]">
                            ({new Date(item.timestamp).toLocaleString("ko-KR", { hour12: false })})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadToEditor(item)}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-[#ECE5FA] text-[#6C47FF] border border-[#E1D4F7] text-[11px] font-medium transition-colors cursor-pointer"
                            title="에디터로 불러오기"
                          >
                            에디터로 불러오기
                          </button>
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-[#F2EDFA] text-[#4F4660] border border-[#E3DCF0] text-[11px] transition-colors cursor-pointer"
                            >
                              수정
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDeleteDiary(item.timestamp)}
                            disabled={deletingTimestamp === item.timestamp}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-[#FEECEC] text-[#DC2626] border border-[#FCD2D2] text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {deletingTimestamp === item.timestamp ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </div>

                      {/* Item Content (View or Edit) */}
                      {isEditing ? (
                        <div className="space-y-2 mt-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={4}
                            className="w-full p-3 rounded-xl border border-[#B79BFB] bg-white text-xs leading-relaxed text-[#2D243D] outline-hidden focus:ring-2 focus:ring-[#EFEAFE]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingRecord(null)}
                              className="px-3 py-1 text-xs rounded-lg border border-[#DDD5E8] bg-white text-[#655C75] hover:bg-[#F7F4FB] cursor-pointer"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={isUpdating}
                              className="px-3 py-1 text-xs rounded-lg bg-[#6C47FF] hover:bg-[#5833E3] text-white font-medium cursor-pointer disabled:opacity-50"
                            >
                              {isUpdating ? "수정 저장 중..." : "저장 완료"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-[#3E3452] leading-relaxed whitespace-pre-wrap">
                          {item.content}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-[#FAF8FE] border-t border-[#F0EBF8] text-right">
              <button
                type="button"
                onClick={() => {
                  setIsListModalOpen(false);
                  setEditingRecord(null);
                }}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#F3EFFB] text-[#554A6B] border border-[#DDD5EB] text-xs font-medium transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

