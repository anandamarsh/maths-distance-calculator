export interface AnalysisCategory {
  category: string;
  questions: string[];
  questionCount: number;
  details: string;
  whyWrong: string;
  howToTeach: string;
  ifTheyUnderstand: string;
}

export interface GlossaryItem {
  term: string;
  explanation: string;
  englishTerm: string;
}

export interface AnalysisData {
  id: string;
  summary: string;
  correct: AnalysisCategory[];
  incorrect: AnalysisCategory[];
  glossary: GlossaryItem[];
}
