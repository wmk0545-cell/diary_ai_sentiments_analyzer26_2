export interface EmotionItem {
  id: 'happy' | 'peace' | 'sad' | 'angry' | 'hope';
  name: string;
  subName: string;
  emoji: string;
  score: number;
}

export interface DetailedEmotion {
  label: string;
  englishLabel: string;
  score: number;
  color: string;
}

export interface SentimentAnalysisResult {
  primaryEmotion: {
    id: 'happy' | 'peace' | 'sad' | 'angry' | 'hope';
    title: string;
    percentage: number;
    description: string;
  };
  mindPrescription: string;
  emotions: EmotionItem[];
  detailedSpectrum: DetailedEmotion[];
  keywords: string[];
  latencySeconds: number;
}

export interface DiaryRecord {
  rowIndex?: number;
  timestamp: string;
  datetime: string;
  content: string;
}

