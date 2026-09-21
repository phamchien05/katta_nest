import { validateGenerated } from './reading.logic';

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
