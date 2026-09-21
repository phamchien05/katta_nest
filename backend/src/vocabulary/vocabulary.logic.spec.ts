import { isAnswerCorrect, isLevel, sampleRandom } from './vocabulary.logic';

describe('isAnswerCorrect', () => {
  it('so khớp không phân biệt hoa thường và khoảng trắng thừa', () => {
    expect(isAnswerCorrect('  Xin Chào ', 'xin chào')).toBe(true);
  });

  it('chấp nhận bất kỳ đáp án nào trong danh sách cách nhau bởi / , ;', () => {
    expect(isAnswerCorrect('quả táo', 'táo / quả táo, trái táo; bom')).toBe(
      true,
    );
    expect(isAnswerCorrect('trái táo', 'táo / quả táo, trái táo; bom')).toBe(
      true,
    );
    expect(isAnswerCorrect('bom', 'táo / quả táo, trái táo; bom')).toBe(true);
  });

  it('sai khi khác nghĩa, và câu bỏ trống là sai', () => {
    expect(isAnswerCorrect('chuối', 'táo')).toBe(false);
    expect(isAnswerCorrect('', 'táo')).toBe(false);
  });

  it('không coi là đúng khi chỉ trùng một phần của đáp án', () => {
    expect(isAnswerCorrect('quả', 'quả táo')).toBe(false);
  });

  it('dấu tiếng Việt dạng dựng sẵn và dạng tổ hợp được coi là như nhau', () => {
    const precomposed = 'tiếng việt'.normalize('NFC');
    const decomposed = 'tiếng việt'.normalize('NFD');
    expect(precomposed).not.toBe(decomposed);
    expect(isAnswerCorrect(decomposed, precomposed)).toBe(true);
  });

  it('câu bỏ trống luôn sai, kể cả khi nghĩa có dấu phân cách thừa', () => {
    expect(isAnswerCorrect('', 'táo;')).toBe(false);
    expect(isAnswerCorrect('   ', 'táo, ')).toBe(false);
  });
});

describe('sampleRandom', () => {
  it('trả về đúng số lượng, không trùng, chỉ gồm phần tử gốc, không đổi mảng gốc', () => {
    const source = Array.from({ length: 100 }, (_, i) => i);
    const picked = sampleRandom(source, 50);
    expect(picked).toHaveLength(50);
    expect(new Set(picked).size).toBe(50);
    expect(picked.every((n) => source.includes(n))).toBe(true);
    expect(source).toEqual(Array.from({ length: 100 }, (_, i) => i));
  });

  it('kho ít hơn yêu cầu thì trả hết kho', () => {
    expect(sampleRandom([1, 2, 3], 50).sort()).toEqual([1, 2, 3]);
    expect(sampleRandom([], 50)).toEqual([]);
  });
});

describe('isLevel', () => {
  it('chỉ nhận 6 cấp độ CEFR viết hoa', () => {
    expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].every(isLevel)).toBe(true);
    expect(isLevel('a1')).toBe(false);
    expect(isLevel('D1')).toBe(false);
    expect(isLevel('')).toBe(false);
  });
});
