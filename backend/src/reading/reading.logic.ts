// 8 chủ đề đúng theo spec - "general" là mục lục theo cấp CEFR (bấm vào sẽ random 1 bài của cấp đó)
export const TOPICS = [
  'general',
  'business',
  'environment',
  'health',
  'history',
  'science',
  'society',
  'technology',
] as const;
export type Topic = (typeof TOPICS)[number];

export const GENERAL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const QUESTION_TYPES = ['fill', 'boolean', 'mcq', 'multi'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

const TOPIC_LABELS: Record<Topic, string> = {
  business: 'kinh doanh',
  environment: 'môi trường',
  general: 'chủ đề tổng quát, đời sống hàng ngày',
  health: 'sức khoẻ',
  history: 'lịch sử',
  science: 'khoa học',
  society: 'xã hội',
  technology: 'công nghệ',
};

// Bài đọc IELTS-style + câu hỏi có đáp án chính xác, không mơ hồ - nên prompt chặt hơn hẳn Từ vựng/Dịch
export function buildPrompt(topic: Topic, level: string): string {
  return `Bạn là chuyên gia biên soạn đề đọc hiểu tiếng Anh kiểu IELTS Reading, dùng để luyện thi cho người Việt học tiếng Anh.

BƯỚC 1 - Viết 1 bài đọc tiếng Anh HOÀN CHỈNH:
- Chủ đề: ${TOPIC_LABELS[topic]}
- Độ khó tương đương cấp CEFR ${level}
- Dài khoảng 150-220 từ, văn phong tự nhiên, thông tin cụ thể, rõ ràng (không mơ hồ, không ẩn dụ khó hiểu)
- Có tiêu đề ngắn gọn, hấp dẫn (dưới 10 từ)

BƯỚC 2 - Viết CHÍNH XÁC 5 câu hỏi đọc hiểu dựa trên bài vừa viết, theo đúng 5 loại sau (mỗi loại đúng 1 câu):
1. "fill" - điền từ/cụm từ còn thiếu. Đáp án BẮT BUỘC là 1 từ hoặc cụm từ NGUYÊN VĂN xuất hiện
   trong bài đọc (để chấm so khớp chính xác được).
2. "boolean" - câu đúng/sai dựa trên thông tin CÓ trong bài. correct_answer là mảng 1 phần tử,
   giá trị CHÍNH XÁC là "True" hoặc "False".
3. "mcq" - trắc nghiệm 4 lựa chọn, chỉ 1 đáp án đúng. Mảng "options" có đúng 4 chuỗi.
4. "multi" - chọn nhiều đáp án đúng trong 4-5 lựa chọn (có từ 2 đáp án đúng trở lên).
5. "fill" - thêm 1 câu điền từ khác (dạng giống câu 1, nội dung khác).

YÊU CẦU BẮT BUỘC để câu hỏi không mơ hồ và chấm được tự động:
- Mỗi câu hỏi chỉ có ĐÚNG 1 cách hiểu và 1 đáp án đúng rõ ràng dựa trên bài đọc, không gây tranh cãi
- Với "mcq" và "multi": mọi giá trị trong "correct_answer" phải TRÙNG KHỚP NGUYÊN VĂN (copy chính xác,
  không viết lại/diễn giải khác đi) với 1 phần tử trong mảng "options" tương ứng
- KHÔNG hỏi về ý kiến cá nhân, suy luận xa, hay thông tin không có trong bài
- Với "boolean"/"fill", trường "options" để mảng rỗng []

Trả về CHÍNH XÁC 1 object JSON theo đúng schema đã cho, không thêm chữ nào khác ngoài object JSON.`;
}

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    content: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' },
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correct_answer: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['type', 'question', 'options', 'correct_answer'],
      },
    },
  },
  required: ['title', 'content', 'questions'],
};

export interface GeneratedQuestion {
  type: QuestionType;
  question: string;
  options: string[];
  correct_answer: string[];
}
export interface GeneratedPassage {
  title: string;
  content: string;
  questions: GeneratedQuestion[];
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

// Kiểm tra đầu ra của AI trước khi lưu DB - tránh rác, và loại bỏ câu hỏi không thể chấm đúng
// (đáp án mcq/multi không nằm trong danh sách lựa chọn, đáp án boolean không phải True/False).
export function validateGenerated(raw: unknown): GeneratedPassage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.title !== 'string' ||
    !r.title.trim() ||
    typeof r.content !== 'string' ||
    !r.content.trim() ||
    !Array.isArray(r.questions) ||
    r.questions.length === 0
  ) {
    return null;
  }

  const questions: GeneratedQuestion[] = [];
  for (const q of r.questions as Record<string, unknown>[]) {
    if (
      typeof q?.type !== 'string' ||
      !(QUESTION_TYPES as readonly string[]).includes(q.type) ||
      typeof q.question !== 'string' ||
      !q.question.trim() ||
      !isStringArray(q.correct_answer) ||
      q.correct_answer.length === 0
    ) {
      return null;
    }
    const options = isStringArray(q.options) ? q.options : [];
    const type = q.type as QuestionType;

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
    questions.push({
      type,
      question: q.question,
      options,
      correct_answer: q.correct_answer,
    });
  }

  return { title: r.title.trim(), content: r.content.trim(), questions };
}

const normalize = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase();

export type UserAnswer = string | string[];

// multi: so sánh TẬP đáp án (không phân biệt thứ tự); còn lại: so với đáp án đầu tiên
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
