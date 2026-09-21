import { choosePassageId } from './picker';

const ids = [1n, 2n, 3n, 4n];
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('choosePassageId', () => {
  it('kho rỗng -> undefined', () => {
    expect(choosePassageId([], { attempted: [], seen: [] })).toBeUndefined();
  });

  it('bỏ qua bài đã nộp, bài đã xem và bài đang xem', () => {
    for (let i = 0; i < 30; i++) {
      expect(
        choosePassageId(ids, { attempted: [1n], seen: [2], excludeId: 3 }),
      ).toBe(4n);
    }
  });

  it('chọn đều trên các bài còn lại (theo số ngẫu nhiên đưa vào)', () => {
    expect(
      choosePassageId(ids, { attempted: [], seen: [], random: () => 0 }),
    ).toBe(1n);
    expect(
      choosePassageId(ids, { attempted: [], seen: [], random: () => 0.99 }),
    ).toBe(4n);
  });

  it('xem hết rồi thì random lại nhưng vẫn tránh bài đang xem', () => {
    for (let i = 0; i < 30; i++) {
      const out = choosePassageId(ids, {
        attempted: ids,
        seen: [],
        excludeId: 2,
      });
      expect(out).not.toBe(2n);
      expect(ids).toContain(out);
    }
  });

  it('chỉ còn đúng bài đang xem thì vẫn trả bài đó', () => {
    expect(
      choosePassageId([7n], { attempted: [], seen: [], excludeId: 7 }),
    ).toBe(7n);
    expect(
      choosePassageId([7n], { attempted: [7n], seen: [7], excludeId: 7 }),
    ).toBe(7n);
  });

  it('id lạ trong seen/attempted không gây lỗi', () => {
    expect(
      choosePassageId(ids, { attempted: [99n], seen: [500], random: seq(0) }),
    ).toBe(1n);
  });
});
