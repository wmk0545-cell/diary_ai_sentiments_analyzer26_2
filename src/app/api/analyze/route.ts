import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { SentimentAnalysisResult } from "@/types/diary";

const analysisSchema = z.object({
  primaryEmotionId: z.enum(["happy", "peace", "sad", "angry", "hope"]),
  primaryEmotionTitle: z.string().describe("오늘의 주요 감정 한줄 요약 (예: 평온 속의 따스한 설렘)"),
  primaryEmotionPercentage: z.number().min(0).max(100),
  mindPrescription: z.string().describe("마인드블룸의 따뜻한 공감 및 마음 처방 코멘트 (2~4문장)"),
  happyScore: z.number().min(0).max(100),
  peaceScore: z.number().min(0).max(100),
  sadScore: z.number().min(0).max(100),
  angryScore: z.number().min(0).max(100),
  hopeScore: z.number().min(0).max(100),
  detailedSpectrum: z.array(
    z.object({
      label: z.string(),
      englishLabel: z.string(),
      score: z.number().min(0).max(100),
    })
  ).min(2).max(4),
  keywords: z.array(z.string()).min(2).max(6),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let diaryText = "";
  try {
    const body = await req.json();
    diaryText = body.diaryText;

    if (!diaryText || typeof diaryText !== "string" || diaryText.trim().length === 0) {
      return NextResponse.json(
        { error: "일기 내용을 입력해주세요." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Gemini API 키가 설정되지 않았습니다. .env.local에 GOOGLE_GENERATIVE_AI_API_KEY 또는 GEMINI_API_KEY를 등록해주세요." },
        { status: 500 }
      );
    }

    const result = await generateObject({
      model: google("gemini-3.1-flash-lite"),
      schema: analysisSchema,
      prompt: `당신은 마인드블룸 AI 감성 분석가입니다. 다음 일기를 정밀하게 분석하여 감정 점수와 따뜻한 마음 처방 코멘트를 생성하세요:
"""
${diaryText}
"""`,
    });

    const elapsed = Number(((Date.now() - startTime) / 1000).toFixed(2));
    const data = result.object;

    const responsePayload: SentimentAnalysisResult = {
      primaryEmotion: {
        id: data.primaryEmotionId,
        title: data.primaryEmotionTitle,
        percentage: data.primaryEmotionPercentage,
        description: data.primaryEmotionTitle,
      },
      mindPrescription: data.mindPrescription,
      emotions: [
        { id: "happy", name: "행복 · 기쁨", subName: "기쁨", emoji: "😊", score: data.happyScore },
        { id: "peace", name: "평온 · 안정", subName: "안정감", emoji: "🌿", score: data.peaceScore },
        { id: "sad", name: "슬픔 · 지침", subName: "지침", emoji: "😢", score: data.sadScore },
        { id: "angry", name: "분노 · 불안", subName: "불안", emoji: "⚡", score: data.angryScore },
        { id: "hope", name: "기대 · 설렘", subName: "설렘", emoji: "✨", score: data.hopeScore },
      ],
      detailedSpectrum: data.detailedSpectrum.map((item, idx) => ({
        label: item.label,
        englishLabel: item.englishLabel,
        score: item.score,
        color: idx === 0 ? "#7c3aed" : idx === 1 ? "#6366f1" : idx === 2 ? "#f59e0b" : "#10b981",
      })),
      keywords: data.keywords.map(k => k.startsWith("#") ? k : "#" + k),
      latencySeconds: elapsed,
    };

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    console.error("AI Sentiment Analysis Error:", error);
    const errorMessage = error instanceof Error ? error.message : "AI 감성 분석에 실패했습니다.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

