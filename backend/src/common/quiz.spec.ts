import {
  cleanAnswers,
  gradeAnswers,
  isCorrect,
  parseStringArray,
  shuffled,
  validateQuestions,
} from './quiz';

describe('isCorrect', () => {
  it('fill/mcq/boolean: so với đáp án đầu tiên, không phân biệt hoa thường/khoảng trắng', () => {
    expect(isCorrect('fill', '  Solar Panels ', ['solar panels'])).toBe(true);
    expect(isCorrect('mcq', 'B', ['b'])).toBe(true);
    expect(isCorrect('boolean', 'true', ['True'])).toBe(true);
    expect(isCorrect('boolean', 'False', ['True'])).toBe(false);
    expect(isCorrect('fill', 'solar', ['solar panels'])).toBe(false);
  });

  it('câu bỏ trống / thiếu đáp án luôn sai', () => {
    expect(isCorrect('fill', '', [''])).toBe(false);
    expect(isCorrect('fill', undefined, ['x'])).toBe(false);
    expect(isCorrect('mcq', '   ', ['x'])).toBe(false);
  });

  it('gửi mảng cho câu không phải multi thì sai (không bị lách)', () => {
    expect(isCorrect('fill', ['solar panels'], ['solar panels'])).toBe(false);
  });

  it('multi: so sánh tập đáp án, không phụ thuộc thứ tự', () => {
    expect(isCorrect('multi', ['B', 'A'], ['A', 'B'])).toBe(true);
    expect(isCorrect('multi', [' a ', 'B'], ['A', 'b'])).toBe(true);
  });

  it('multi: thiếu, thừa hoặc sai một đáp án đều sai', () => {
    expect(isCorrect('multi', ['A'], ['A', 'B'])).toBe(false);
    expect(isCorrect('multi', ['A', 'B', 'C'], ['A', 'B'])).toBe(false);
    expect(isCorrect('multi', ['A', 'C'], ['A', 'B'])).toBe(false);
    expect(isCorrect('multi', [], ['A', 'B'])).toBe(false);
    expect(isCorrect('multi', 'A', ['A', 'B'])).toBe(false);
  });

  it('multi: chọn trùng một đáp án hai lần không được tính là chọn đủ', () => {
    expect(isCorrect('multi', ['A', 'A'], ['A', 'B'])).toBe(false);
  });
});

describe('parseStringArray', () => {
  it('đọc mảng JSON kiểu Laravel', () => {
    expect(parseStringArray('["a","b"]')).toEqual(['a', 'b']);
    expect(parseStringArray('[]')).toEqual([]);
  });

  it('null, rỗng, JSON hỏng hoặc sai kiểu -> mảng rỗng', () => {
    expect(parseStringArray(null)).toEqual([]);
    expect(parseStringArray('')).toEqual([]);
    expect(parseStringArray('{not json')).toEqual([]);
    expect(parseStringArray('{"a":1}')).toEqual([]);
    expect(parseStringArray('[1,2]')).toEqual([]);
  });
});

describe('cleanAnswers', () => {
  it('giữ chuỗi và mảng chuỗi hợp lệ', () => {
    expect(cleanAnswers({ '1': 'abc', '2': ['a', 'b'] })).toEqual({
      '1': 'abc',
      '2': ['a', 'b'],
    });
  });

  it('bỏ số, null, object lồng nhau, mảng lẫn kiểu, chuỗi/mảng quá dài', () => {
    const out = cleanAnswers({
      a: 5,
      b: null,
      c: { x: 1 },
      d: ['a', 1],
      e: 'x'.repeat(501),
      f: Array.from({ length: 11 }, () => 'x'),
      g: ['x'.repeat(501)],
      ok: 'giữ',
    });
    expect(out).toEqual({ ok: 'giữ' });
  });
});

describe('gradeAnswers', () => {
  const questions = [
    { id: 1n, type: 'fill', correct_answer: '["sun"]' },
    { id: 2n, type: 'multi', correct_answer: '["a","b"]' },
    { id: 3n, type: 'mcq', correct_answer: '["x"]' },
  ];

  it('chấm từng câu, tính điểm và trả đáp án đúng', () => {
    const { score, results } = gradeAnswers(questions, {
      '1': ' SUN ',
      '2': ['b', 'a'],
      '3': 'y',
    });
    expect(score).toBe(2);
    expect(results).toEqual([
      { questionId: 1, isCorrect: true, correctAnswer: ['sun'] },
      { questionId: 2, isCorrect: true, correctAnswer: ['a', 'b'] },
      { questionId: 3, isCorrect: false, correctAnswer: ['x'] },
    ]);
  });

  it('câu thiếu đáp án bị chấm sai; correct_answer hỏng không làm sập', () => {
    const { score, results } = gradeAnswers(
      [...questions, { id: 4n, type: 'fill', correct_answer: '{hong' }],
      {},
    );
    expect(score).toBe(0);
    expect(results[3].correctAnswer).toEqual([]);
  });
});

describe('validateQuestions', () => {
  const q = (o: object) => ({
    type: 'fill',
    question: 'Q',
    options: [],
    correct_answer: ['x'],
    ...o,
  });

  it('chỉ nhận các loại câu được phép', () => {
    expect(validateQuestions([q({})], ['fill'])).toHaveLength(1);
    expect(
      validateQuestions(
        [q({ type: 'boolean', correct_answer: ['True'] })],
        ['fill', 'mcq'],
      ),
    ).toBeNull();
  });

  it('không phải mảng hoặc mảng rỗng -> null', () => {
    expect(validateQuestions(undefined, ['fill'])).toBeNull();
    expect(validateQuestions([], ['fill'])).toBeNull();
    expect(validateQuestions('x', ['fill'])).toBeNull();
  });

  it('sai một câu là loại cả bộ', () => {
    expect(
      validateQuestions([q({}), q({ question: '' })], ['fill']),
    ).toBeNull();
    expect(
      validateQuestions(
        [q({}), q({ type: 'mcq', options: ['a', 'b'], correct_answer: ['z'] })],
        ['fill', 'mcq'],
      ),
    ).toBeNull();
  });

  it('phần tử null/không phải object không làm sập', () => {
    expect(validateQuestions([null], ['fill'])).toBeNull();
    expect(validateQuestions([42], ['fill'])).toBeNull();
  });
});

describe('shuffled', () => {
  it('giữ nguyên các phần tử, không đổi mảng gốc', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(src);
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('xáo thật sự (không luôn trả về đúng thứ tự cũ) và dùng được random cố định', () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffled(src).join()).not.toBe(src.join());
    expect(shuffled(src, () => 0)).toEqual(shuffled(src, () => 0));
  });
});
