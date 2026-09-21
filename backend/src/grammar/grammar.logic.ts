import { validateQuestions, type GeneratedQuestion } from '../common/quiz';

// Khớp đúng slug của 5 nhánh gốc trong grammar_topics (Phần A: lý thuyết) - dùng chung 1 khoá để
// Phần B (luyện tập) bám sát đúng nội dung lý thuyết của nhánh tương ứng.
export const PRACTICE_TOPICS = {
  'parts-of-speech': 'Parts of Speech',
  tenses: 'Tenses',
  'sentence-structures': 'Sentence Structures',
  'question-forms': 'Question Forms',
  'common-structures': 'Common Structures',
} as const;
export type PracticeTopic = keyof typeof PRACTICE_TOPICS;
export const PRACTICE_TOPIC_KEYS = Object.keys(
  PRACTICE_TOPICS,
) as PracticeTopic[];

export const QUESTION_COUNT = 35; // giữa khoảng 30-50 theo yêu cầu
const FILL_COUNT = 14;
const MCQ_COUNT = 14;
const MULTI_COUNT = 7;

// Chấp nhận AI sinh hơi lệch số lượng, miễn còn trong khoảng này
export const MIN_ACCEPTED = 25;
export const MAX_ACCEPTED = 60;

export interface TopicNode {
  id: bigint;
  parent_id: bigint | null;
  slug: string;
  title: string;
  content_en: string | null;
}

// Nội dung lý thuyết (HTML) -> văn bản thuần một dòng cho AI đọc
function toPlainText(html: string): string {
  return html
    .replace(/<\/?(p|h3)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Gom nội dung lý thuyết (content_en) của toàn bộ chủ đề con dưới 1 nhánh gốc theo thứ tự cây (`topics` đã sắp theo
// `order`), làm tài liệu gốc để AI bám sát kiến thức đã dạy ở Phần A thay vì tự bịa điểm ngữ pháp ngoài chương trình.
export function buildGrounding(
  topics: readonly TopicNode[],
  rootSlug: string,
): string {
  const root = topics.find((t) => t.slug === rootSlug);
  if (!root) return '';

  const lines: string[] = [];
  const collect = (parentId: bigint) => {
    for (const t of topics) {
      if (t.parent_id !== parentId) continue;
      if (t.content_en?.trim()) {
        lines.push(`### ${t.title}\n${toPlainText(t.content_en)}`);
      }
      collect(t.id);
    }
  };
  collect(root.id);
  return lines.join('\n\n');
}

export function buildPrompt(
  topicKey: PracticeTopic,
  grounding: string,
): string {
  return `You are an expert English grammar exam writer creating a practice quiz for Vietnamese learners of English (IELTS-style grammar practice).

Below is the REFERENCE GRAMMAR MATERIAL for the topic "${PRACTICE_TOPICS[topicKey]}". Base EVERY question strictly on the rules and structures explained in this material - do not test any grammar point that is not covered here:

---
${grounding}
---

Write EXACTLY ${QUESTION_COUNT} grammar practice questions testing the material above, made up of exactly:
- ${FILL_COUNT} questions of type "fill": a sentence with a blank ("___") to fill in with the correct word/phrase/verb form. "options" is an empty array []. "correct_answer" is an array with exactly 1 short accepted answer (1-4 words).
- ${MCQ_COUNT} questions of type "mcq": a question or sentence with a blank, with exactly 4 options, only 1 correct answer. "options" has exactly 4 strings; "correct_answer" has exactly 1 string that must match one option exactly.
- ${MULTI_COUNT} questions of type "multi": a question with 4-5 options where 2 or more are correct (e.g. "select all that apply"). "options" has 4-5 strings; "correct_answer" has 2 or more strings, each matching an option exactly.

STRICT REQUIREMENTS so every question can be graded automatically and unambiguously:
- Every question must have exactly ONE unambiguous correct interpretation based on standard English grammar rules - no room for debate.
- For "mcq" and "multi": every value in "correct_answer" must be an EXACT copy of one of the "options" strings (no paraphrasing, no extra punctuation).
- Write NEW example sentences that test the same rules - do not copy the example sentences from the reference material verbatim.
- Cover a good variety of the different sub-topics listed in the reference material, not just one or two of them repeatedly.
- Do not number the questions yourself; the "question" field should contain only the sentence/instruction text.

Return ONLY 1 JSON object matching the given schema, no extra text.`;
}

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
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
  required: ['questions'],
};

export function validateGeneratedSet(raw: unknown): GeneratedQuestion[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const questions = validateQuestions(
    (raw as { questions?: unknown }).questions,
    ['fill', 'mcq', 'multi'],
  );
  if (
    !questions ||
    questions.length < MIN_ACCEPTED ||
    questions.length > MAX_ACCEPTED
  ) {
    return null;
  }
  return questions;
}
