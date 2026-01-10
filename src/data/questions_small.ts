export interface Choice {
  label: string;
  text: string;
  images?: { src: string; alt: string; local?: string }[];
}

export interface Question {
  question_number: number;
  test_name: string;
  passage: string | null;
  question_text: string | null;
  choices: Choice[];
  is_fill_in_blank: boolean;
  correct_answer: string | null;
  id: string;
  images?: { src: string; alt: string; local?: string }[];
}

const questions: Question[] = [
  {
    question_number: 1,
    test_name: "Test",
    passage: "Test passage",
    question_text: "Test question",
    choices: [],
    is_fill_in_blank: false,
    correct_answer: "A",
    id: "test_1",
  }
];

export default questions;
