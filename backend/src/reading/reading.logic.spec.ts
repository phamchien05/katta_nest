import {
  isCorrect,
  parseStringArray,
  validateGenerated,
} from './reading.logic';

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

describe('validateGenerated', () => {
  const good = () => ({
    title: ' Solar Power ',
    content: ' Some text. ',
    questions: [
      { type: 'fill', question: 'Q1', options: [], correct_answer: ['sun'] },
      {
        type: 'boolean',
        question: 'Q2',
        options: [],
        correct_answer: ['True'],
      },
      {
        type: 'mcq',
        question: 'Q3',
        options: ['a', 'b', 'c', 'd'],
        correct_answer: ['b'],
      },
      {
        type: 'multi',
        question: 'Q4',
        options: ['a', 'b', 'c', 'd'],
        correct_answer: ['a', 'c'],
      },
    ],
  });

  it('chấp nhận bài hợp lệ và cắt khoảng trắng đầu/cuối', () => {
    const out = validateGenerated(good());
    expect(out?.title).toBe('Solar Power');
    expect(out?.content).toBe('Some text.');
    expect(out?.questions).toHaveLength(4);
  });

  it('từ chối thiếu tiêu đề/nội dung/câu hỏi hoặc không phải object', () => {
    expect(validateGenerated(null)).toBeNull();
    expect(validateGenerated('x')).toBeNull();
    expect(validateGenerated({ ...good(), title: '  ' })).toBeNull();
    expect(validateGenerated({ ...good(), content: '' })).toBeNull();
    expect(validateGenerated({ ...good(), questions: [] })).toBeNull();
    expect(validateGenerated({ ...good(), questions: 'x' })).toBeNull();
  });

  it('từ chối loại câu lạ, câu hỏi rỗng, thiếu đáp án', () => {
    const withQ = (q: object) => ({ ...good(), questions: [q] });
    expect(
      validateGenerated(
        withQ({
          type: 'essay',
          question: 'Q',
          options: [],
          correct_answer: ['x'],
        }),
      ),
    ).toBeNull();
    expect(
      validateGenerated(
        withQ({
          type: 'fill',
          question: '',
          options: [],
          correct_answer: ['x'],
        }),
      ),
    ).toBeNull();
    expect(
      validateGenerated(
        withQ({ type: 'fill', question: 'Q', options: [], correct_answer: [] }),
      ),
    ).toBeNull();
    expect(
      validateGenerated(withQ({ type: 'fill', question: 'Q', options: [] })),
    ).toBeNull();
  });

  it('mcq/multi: cần có options và đáp án đúng phải nằm trong options (nếu không thì không chấm được)', () => {
    const withQ = (q: object) => ({ ...good(), questions: [q] });
    expect(
      validateGenerated(
        withQ({
          type: 'mcq',
          question: 'Q',
          options: [],
          correct_answer: ['a'],
        }),
      ),
    ).toBeNull();
    expect(
      validateGenerated(
        withQ({
          type: 'mcq',
          question: 'Q',
          options: ['a', 'b'],
          correct_answer: ['z'],
        }),
      ),
    ).toBeNull();
    expect(
      validateGenerated(
        withQ({
          type: 'multi',
          question: 'Q',
          options: ['a', 'b', 'c'],
          correct_answer: ['a', 'z'],
        }),
      ),
    ).toBeNull();
  });

  it('boolean: đáp án bắt buộc là True hoặc False', () => {
    const withQ = (answer: string) => ({
      ...good(),
      questions: [
        {
          type: 'boolean',
          question: 'Q',
          options: [],
          correct_answer: [answer],
        },
      ],
    });
    expect(validateGenerated(withQ('True'))).not.toBeNull();
    expect(validateGenerated(withQ('Yes'))).toBeNull();
  });
});
