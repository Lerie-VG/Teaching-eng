export type ExamLevel = 'CAE' | 'CPE';
export type TaskType = 'Essay' | 'Proposal' | 'Report' | 'Review' | 'Letter';

export interface Criterion {
  name: string;
  score: number;
  feedback: string;
  suggestions?: string[];
}

export interface AnalysisResult {
  overallScore: number;
  criteria: Criterion[];
  errors?: Array<{
    text: string;
    correction: string;
    type: string;
    explanation: string;
    start?: number;
    end?: number;
  }>;
}

export interface AnalysisRequest {
  examLevel: ExamLevel;
  taskType: TaskType;
  writing: string;
} 