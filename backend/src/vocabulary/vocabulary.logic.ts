// 6 cấp độ CEFR hỗ trợ trong app (giống VocabularyController::LEVELS bên Laravel)
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export const QUESTIONS_PER_QUIZ = 50;

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

// Chuẩn hoá để so khớp: bỏ khoảng trắng thừa, chữ thường, và đưa dấu tiếng Việt về cùng một dạng Unicode
// (bộ gõ khác nhau có thể sinh ra "ệ" dạng dựng sẵn hoặc dạng tổ hợp - trông giống hệt nhưng khác byte)
const normalize = (s: string): string =>
  s.normalize('NFC').trim().toLowerCase();

// So khớp đơn giản: cho phép nhiều đáp án đúng cách nhau bởi / , ;
export function isAnswerCorrect(
  userAnswer: string,
  correctMeaning: string,
): boolean {
  const given = normalize(userAnswer);
  // Câu bỏ trống luôn sai (kể cả khi nghĩa trong DB có dấu phân cách thừa tạo ra một phần rỗng)
  if (given === '') return false;
  return correctMeaning
    .split(/[/,;]/u)
    .some((candidate) => normalize(candidate) === given);
}

// Chọn ngẫu nhiên tối đa `count` phần tử (Fisher-Yates từng phần) - không đụng tới mảng gốc
export function sampleRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = [...items];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
