// Logic câu hỏi/chấm điểm dùng chung cho Đọc hiểu, Ngữ pháp, Nghe (4 loại: fill, boolean, mcq, multi).

export const QUESTION_TYPES = ['fill', 'boolean', 'mcq', 'multi'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Đáp án của 1 câu: chuỗi (fill/boolean/mcq) hoặc mảng chuỗi (multi)
export type UserAnswer = string | string[];

export const MAX_ANSWER_LENGTH = 500;

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

const normalize = (s: unknown): string =>
  (typeof s === 'string' ? s : '').normalize('NFC').trim().toLowerCase();

// multi: so sánh TẬP đáp án (không phân biệt thứ tự); còn lại: so với đáp án đầu tiên.
// Câu bỏ trống luôn sai.
export function isCorrect(
  type: string,
  userAnswer: UserAnswer | undefined,
  correctAnswer: string[],
): boolean {
  if (type === 'multi') {
    const user = new Set(
      (Array.isArray(userAnswer) ? userAnswer : []).map(normalize),
    );
    const correct = new Set(correctAnswer.map(normalize));
    return user.size === correct.size && [...correct].every((c) => user.has(c));
  }
  const given = Array.isArray(userAnswer) ? '' : normalize(userAnswer);
  return given !== '' && given === normalize(correctAnswer[0]);
}

// Đọc cột JSON kiểu Laravel (options / correct_answer) - hỏng thì coi như mảng rỗng
export function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return isStringArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Đáp án tới từ client nên không tin: chỉ nhận string hoặc mảng string ngắn, bỏ mọi thứ khác
// (số, null, object lồng nhau...). Câu nào bị bỏ thì coi như chưa trả lời.
export function cleanAnswers(
  raw: Record<string, unknown>,
): Record<string, UserAnswer> {
  const out: Record<string, UserAnswer> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH) {
      out[key] = value;
    } else if (
      isStringArray(value) &&
      value.length <= 10 &&
      value.every((v) => v.length <= MAX_ANSWER_LENGTH)
    ) {
      out[key] = value;
    }
  }
  return out;
}

export interface StoredQuestion {
  id: bigint;
  type: string;
  correct_answer: string | null;
}

export interface GradedQuestion {
  questionId: number;
  isCorrect: boolean;
  correctAnswer: string[];
}

// Chấm cả bộ câu hỏi. `answers` đã qua cleanAnswers; khoá là id câu hỏi dạng chuỗi.
export function gradeAnswers(
  questions: StoredQuestion[],
  answers: Record<string, UserAnswer>,
): { score: number; results: GradedQuestion[] } {
  let score = 0;
  const results = questions.map((q) => {
    const correctAnswer = parseStringArray(q.correct_answer);
    const ok = isCorrect(q.type, answers[String(q.id)], correctAnswer);
    if (ok) score++;
    return { questionId: Number(q.id), isCorrect: ok, correctAnswer };
  });
  return { score, results };
}

export interface GeneratedQuestion {
  type: QuestionType;
  question: string;
  options: string[];
  correct_answer: string[];
}

// Kiểm tra danh sách câu hỏi do AI sinh trước khi lưu DB: đúng cấu trúc, và loại bỏ câu KHÔNG thể chấm đúng
// (đáp án mcq/multi không nằm trong lựa chọn, đáp án boolean không phải True/False). Sai 1 câu là loại cả bộ.
export function validateQuestions(
  raw: unknown,
  allowed: readonly QuestionType[],
): GeneratedQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const out: GeneratedQuestion[] = [];
  for (const q of raw as Record<string, unknown>[]) {
    if (
      typeof q?.type !== 'string' ||
      !(allowed as readonly string[]).includes(q.type) ||
      typeof q.question !== 'string' ||
      !q.question.trim() ||
      !isStringArray(q.correct_answer) ||
      q.correct_answer.length === 0
    ) {
      return null;
    }
    const type = q.type as QuestionType;
    const options = isStringArray(q.options) ? q.options : [];

    if (type === 'mcq' || type === 'multi') {
      if (options.length === 0) return null;
      if (!q.correct_answer.every((a) => options.includes(a))) return null;
    }
    if (
      type === 'boolean' &&
      !['True', 'False'].includes(q.correct_answer[0])
    ) {
      return null;
    }
    out.push({
      type,
      question: q.question,
      options,
      correct_answer: q.correct_answer,
    });
  }
  return out;
}

// Fisher-Yates không đụng mảng gốc - để các loại câu hỏi xen kẽ nhau thay vì dồn cục theo từng loại
export function shuffled<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
