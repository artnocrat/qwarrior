export interface AIQuestion {
  question_text: string;
  question_type: 'MULTIPLE_CHOICE' | 'THEORY';
  options: {
    text: string;
    is_correct: boolean;
  }[];
  correct_answer_explanation: string;
  topic: string; // The topic name, e.g., "Thermodynamics"
  difficulty_level: number; // 1-5
}

export interface AIResponse {
  questions: AIQuestion[];
}
