// 5 cấp độ dịch (A1-C1, khác Từ vựng có thêm C2) và 2 chiều dịch
export const TRANSLATE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type TranslateLevel = (typeof TRANSLATE_LEVELS)[number];

export const DIRECTIONS = ['en_vi', 'vi_en'] as const;
export type Direction = (typeof DIRECTIONS)[number];

// Không có API key / Gemini lỗi: chấm tạm theo độ dài (tối đa 70 điểm vì chưa có AI thật)
export const SIMPLE_GRADE_NOTICE =
  'Gemini API key is not configured, so this is a simple length-based estimate. Add your key in Settings for accurate AI grading.';

const LEVEL_DESCRIPTIONS: Record<TranslateLevel, string> = {
  A1: 'người mới bắt đầu, câu đơn giản, thì hiện tại đơn, từ vựng cơ bản (gia đình, trường học, đồ vật hàng ngày)',
  A2: 'sơ cấp, câu ghép đơn giản, thì quá khứ/tương lai đơn, chủ đề đời sống hàng ngày (mua sắm, du lịch ngắn, sở thích)',
  B1: 'trung cấp, nhiều mệnh đề phụ, thể hiện quan điểm cá nhân, chủ đề quen thuộc (văn hoá, công nghệ, môi trường, sức khoẻ)',
  B2: 'trung cao cấp, lập luận rõ ràng, từ vựng trừu tượng vừa phải, chủ đề xã hội (giáo dục, mạng xã hội, công việc, đô thị hoá)',
  C1: 'cao cấp, lập luận phức tạp, từ vựng học thuật/trừu tượng, chủ đề chuyên sâu (kinh tế, chính sách, công nghệ AI, toàn cầu hoá)',
};

const languageNames = (direction: Direction) => ({
  source: direction === 'en_vi' ? 'tiếng Anh' : 'tiếng Việt',
  target: direction === 'en_vi' ? 'tiếng Việt' : 'tiếng Anh',
});

export function buildGenerationPrompt(
  level: TranslateLevel,
  direction: Direction,
  count: number,
): string {
  const lang = languageNames(direction).source;
  return `Viết ${count} đoạn văn ${lang} HOÀN TOÀN KHÁC NHAU (chủ đề khác nhau, không trùng lặp ý), mỗi đoạn
khoảng 100-160 từ, liền mạch, tự nhiên như văn viết thật (không phải danh sách từ), phù hợp để
người học dùng luyện dịch sang ngôn ngữ khác.

Độ khó: cấp độ CEFR ${level} - ${LEVEL_DESCRIPTIONS[level]}.

Trả về CHÍNH XÁC 1 mảng JSON gồm ${count} chuỗi, mỗi chuỗi là 1 đoạn văn hoàn chỉnh,
không thêm tiêu đề, không đánh số, không thêm chữ nào khác ngoài mảng JSON.`;
}

export function buildGradingPrompt(
  direction: Direction,
  source: string,
  translation: string,
): string {
  const { source: from, target: to } = languageNames(direction);
  return `Bạn là giáo viên chấm bài dịch ${from}-${to}. Chấm bản dịch của học viên cho đoạn văn
${from} dưới đây, theo thang điểm 0-100 (độ chính xác nghĩa, ngữ pháp, tự nhiên khi đọc).

Đoạn văn gốc (${from}):
${source}

Bản dịch của học viên (${to}):
${translation}

Trả về CHÍNH XÁC 1 object JSON gồm:
- "score": số nguyên 0-100
- "feedback": nhận xét tổng quát ngắn gọn (2-3 câu) bằng tiếng Việt
- "reference_translation": 1 bản dịch mẫu chuẩn, tự nhiên, bằng ${to}
- "issues": mảng chuỗi, mỗi phần tử là 1 lỗi CỤ THỂ trong bài của học viên (trích đúng phần bị sai +
  giải thích ngắn tại sao sai), tối đa 5 lỗi quan trọng nhất; nếu không có lỗi thì trả về mảng rỗng []

Không thêm chữ nào khác ngoài object JSON.`;
}

export const GRADING_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER' },
    feedback: { type: 'STRING' },
    reference_translation: { type: 'STRING' },
    issues: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['score', 'feedback', 'reference_translation', 'issues'],
};

export interface Grade {
  score: number;
  feedback: string | null;
  referenceTranslation: string | null;
  issues: string[];
  gradedBy: 'ai' | 'simple';
}

// Chuẩn hoá kết quả thô của Gemini; null nếu thiếu/sai định dạng (để rơi về chấm đơn giản)
export function normalizeAiGrade(raw: unknown): Grade | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const score = Number(r.score);
  if (r.score === undefined || r.score === null || !Number.isFinite(score)) {
    return null;
  }

  return {
    score: Math.max(0, Math.min(100, Math.trunc(score))),
    feedback: typeof r.feedback === 'string' ? r.feedback : '',
    referenceTranslation:
      typeof r.reference_translation === 'string'
        ? r.reference_translation
        : null,
    issues: Array.isArray(r.issues)
      ? r.issues.filter((i): i is string => typeof i === 'string' && i !== '')
      : [],
    gradedBy: 'ai',
  };
}

// Chấm tạm dựa độ dài bản dịch so với gốc (đếm từ theo khoảng trắng để đúng cả tiếng Việt có dấu)
export function simpleGrade(translation: string, source: string): Grade {
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const sourceWords = words(source);
  const ratio = sourceWords > 0 ? words(translation) / sourceWords : 0;
  return {
    score: Math.round(Math.min(1, ratio) * 70),
    feedback: null,
    referenceTranslation: null,
    issues: [],
    gradedBy: 'simple',
  };
}
