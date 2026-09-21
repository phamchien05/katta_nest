import {
  buildPrompt,
  FIXED_LEVELS,
  levelFor,
  pickScenario,
  SCENARIO_SEEDS,
  TOPICS,
  validateGenerated,
} from './listening.logic';

describe('levelFor', () => {
  it('chủ đề cố định luôn theo cấp gắn cứng, bỏ qua cấp được yêu cầu', () => {
    expect(levelFor('everyday_conversation', 'C1')).toBe('A2');
    expect(levelFor('social_monologue', null)).toBe('B1');
    expect(levelFor('academic_discussion')).toBe('B2');
    expect(levelFor('academic_lecture', 'A1')).toBe('C1');
  });

  it('general theo cấp yêu cầu, mặc định B2', () => {
    expect(levelFor('general', 'A1')).toBe('A1');
    expect(levelFor('general', null)).toBe('B2');
    expect(levelFor('general')).toBe('B2');
  });

  it('có đủ 4 chủ đề cố định cấp', () => {
    expect(Object.keys(FIXED_LEVELS)).toHaveLength(4);
  });
});

describe('pickScenario', () => {
  it('mọi chủ đề đều có kịch bản, và kết quả nằm trong danh sách của chủ đề đó', () => {
    for (const topic of TOPICS) {
      expect(SCENARIO_SEEDS[topic].length).toBeGreaterThanOrEqual(10);
      expect(SCENARIO_SEEDS[topic]).toContain(pickScenario(topic));
    }
  });

  it('chọn theo số ngẫu nhiên đưa vào (đầu / cuối danh sách)', () => {
    expect(pickScenario('general', () => 0)).toBe(SCENARIO_SEEDS.general[0]);
    expect(pickScenario('general', () => 0.9999)).toBe(
      SCENARIO_SEEDS.general.at(-1),
    );
  });

  it('nhiều lần gọi cho ra nhiều kịch bản khác nhau (chống bài trùng nhau)', () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => pickScenario('academic_lecture')),
    );
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('buildPrompt', () => {
  it('nhúng kịch bản, cấp độ và mô tả dạng bài', () => {
    const p = buildPrompt(
      'everyday_conversation',
      'A2',
      'ordering food at a restaurant',
    );
    expect(p).toContain('ordering food at a restaurant');
    expect(p).toContain('CEFR level A2');
    expect(p).toContain('two-person everyday conversation');
  });

  it('có tiêu đề bài đã tồn tại thì yêu cầu AI tránh trùng; không có thì bỏ phần đó', () => {
    const withTitles = buildPrompt('general', 'B1', 's', [
      'Old One',
      'Old Two',
    ]);
    expect(withTitles).toContain('"Old One", "Old Two"');
    expect(withTitles).toContain('clearly DIFFERENT');
    expect(buildPrompt('general', 'B1', 's', [])).not.toContain(
      'already exist',
    );
  });
});

describe('validateGenerated', () => {
  const good = () => ({
    title: ' Booking a Room ',
    transcript: ' Hello there. ',
    questions: [
      { type: 'fill', question: 'Q', options: [], correct_answer: ['room'] },
      {
        type: 'boolean',
        question: 'Q',
        options: [],
        correct_answer: ['False'],
      },
    ],
  });

  it('chấp nhận bài hợp lệ và cắt khoảng trắng', () => {
    const out = validateGenerated(good());
    expect(out?.title).toBe('Booking a Room');
    expect(out?.transcript).toBe('Hello there.');
    expect(out?.questions).toHaveLength(2);
  });

  it('từ chối thiếu tiêu đề/lời thoại/câu hỏi, hoặc có câu không chấm được', () => {
    expect(validateGenerated(null)).toBeNull();
    expect(validateGenerated({ ...good(), title: '' })).toBeNull();
    expect(validateGenerated({ ...good(), transcript: '  ' })).toBeNull();
    expect(validateGenerated({ ...good(), questions: [] })).toBeNull();
    expect(
      validateGenerated({
        ...good(),
        questions: [
          { type: 'mcq', question: 'Q', options: ['a'], correct_answer: ['z'] },
        ],
      }),
    ).toBeNull();
  });
});
