import {
  buildGrounding,
  buildPrompt,
  PRACTICE_TOPIC_KEYS,
  validateGeneratedSet,
  type TopicNode,
} from './grammar.logic';

const node = (
  id: number,
  parent: number | null,
  slug: string,
  title: string,
  content: string | null,
): TopicNode => ({
  id: BigInt(id),
  parent_id: parent === null ? null : BigInt(parent),
  slug,
  title,
  content_en: content,
});

describe('buildGrounding', () => {
  // tenses
  //  ├─ present (nhóm, không nội dung)
  //  │   ├─ present-simple
  //  │   └─ present-continuous
  //  └─ past-simple
  // other (nhánh khác - không được lẫn vào)
  const topics = [
    node(1, null, 'tenses', 'Tenses', null),
    node(2, 1, 'present', 'Present', null),
    node(
      3,
      2,
      'present-simple',
      'Present Simple',
      '<h3>Use</h3><p>Habits &amp; <strong>facts</strong>.</p>',
    ),
    node(
      4,
      2,
      'present-continuous',
      'Present Continuous',
      '<p>Happening   now</p>\n<p>be + V-ing</p>',
    ),
    node(5, 1, 'past-simple', 'Past Simple', '<p>Finished actions</p>'),
    node(6, null, 'other', 'Other', null),
    node(7, 6, 'other-child', 'Other Child', '<p>SHOULD NOT APPEAR</p>'),
  ];

  it('gom nội dung các chủ đề con theo thứ tự cây, bỏ thẻ HTML và khoảng trắng thừa', () => {
    const out = buildGrounding(topics, 'tenses');
    expect(out).toBe(
      [
        '### Present Simple\nUse Habits &amp; facts.',
        '### Present Continuous\nHappening now be + V-ing',
        '### Past Simple\nFinished actions',
      ].join('\n\n'),
    );
  });

  it('không lẫn nội dung của nhánh khác', () => {
    expect(buildGrounding(topics, 'tenses')).not.toContain('SHOULD NOT APPEAR');
    expect(buildGrounding(topics, 'other')).toBe(
      '### Other Child\nSHOULD NOT APPEAR',
    );
  });

  it('slug không tồn tại hoặc nhánh chưa có nội dung -> chuỗi rỗng', () => {
    expect(buildGrounding(topics, 'nope')).toBe('');
    expect(
      buildGrounding([node(1, null, 'empty', 'Empty', null)], 'empty'),
    ).toBe('');
  });

  it('bỏ qua chủ đề có nội dung chỉ toàn khoảng trắng', () => {
    const t = [
      node(1, null, 'root', 'Root', null),
      node(2, 1, 'c', 'Child', '   '),
    ];
    expect(buildGrounding(t, 'root')).toBe('');
  });
});

describe('buildPrompt', () => {
  it('nhúng tên chủ đề, tài liệu gốc và số lượng từng loại câu', () => {
    const prompt = buildPrompt('tenses', 'GROUNDING-TEXT');
    expect(prompt).toContain('topic "Tenses"');
    expect(prompt).toContain('GROUNDING-TEXT');
    expect(prompt).toContain('EXACTLY 35');
    expect(prompt).toContain('14 questions of type "fill"');
    expect(prompt).toContain('14 questions of type "mcq"');
    expect(prompt).toContain('7 questions of type "multi"');
  });
});

describe('PRACTICE_TOPIC_KEYS', () => {
  it('đúng 5 nhánh gốc của phần lý thuyết', () => {
    expect(PRACTICE_TOPIC_KEYS).toEqual([
      'parts-of-speech',
      'tenses',
      'sentence-structures',
      'question-forms',
      'common-structures',
    ]);
  });
});

describe('validateGeneratedSet', () => {
  const fill = (n: number) => ({
    type: 'fill',
    question: `Q${n}`,
    options: [],
    correct_answer: ['x'],
  });
  const setOf = (n: number) => ({
    questions: Array.from({ length: n }, (_, i) => fill(i)),
  });

  it('chấp nhận 25-60 câu hợp lệ', () => {
    expect(validateGeneratedSet(setOf(25))).toHaveLength(25);
    expect(validateGeneratedSet(setOf(35))).toHaveLength(35);
    expect(validateGeneratedSet(setOf(60))).toHaveLength(60);
  });

  it('từ chối quá ít, quá nhiều, hoặc không phải object', () => {
    expect(validateGeneratedSet(setOf(24))).toBeNull();
    expect(validateGeneratedSet(setOf(61))).toBeNull();
    expect(validateGeneratedSet(null)).toBeNull();
    expect(validateGeneratedSet({})).toBeNull();
  });

  it('không nhận câu boolean (Ngữ pháp chỉ có fill/mcq/multi) và loại bộ có câu không chấm được', () => {
    const withBad = (q: object) => ({
      questions: [...setOf(30).questions, q],
    });
    expect(
      validateGeneratedSet(
        withBad({
          type: 'boolean',
          question: 'Q',
          options: [],
          correct_answer: ['True'],
        }),
      ),
    ).toBeNull();
    expect(
      validateGeneratedSet(
        withBad({
          type: 'mcq',
          question: 'Q',
          options: ['a', 'b'],
          correct_answer: ['z'],
        }),
      ),
    ).toBeNull();
  });
});
