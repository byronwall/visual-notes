export interface Session {
  id: string;
  prompt: string;
  title?: string;
  description?: string;
  rounds: Round[];
  createdAt: string;
  updatedAt: string;
}

export interface Round {
  id: string;
  questions: Question[];
  answers: Answer[];
  result: string | null;
  createdAt: string;
}

export type QuestionType = "goal_discovery" | "user_goals" | "output_related";

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: Option[];
}

export interface Option {
  id: string;
  text: string;
}

export interface Answer {
  questionId: string;
  selectedOptionIds: string[];
  customInput: string | null;
}
