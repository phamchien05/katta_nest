// Bảng giả trong bộ nhớ, bắt chước phần Prisma mà app dùng: where (bằng, not, in, notIn, gt/gte/lt/lte,
// contains, AND/OR/NOT), orderBy, take/skip, count, create/update/upsert/delete. KHÔNG đụng MySQL thật.
type Row = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Row =>
  typeof v === 'object' &&
  v !== null &&
  !(v instanceof Date) &&
  typeof v !== 'bigint' &&
  !Array.isArray(v);

const comparable = (v: unknown) => (v instanceof Date ? v.getTime() : v);

function matchField(actual: unknown, cond: unknown): boolean {
  if (!isPlainObject(cond)) return comparable(actual) === comparable(cond);

  return Object.entries(cond).every(([op, expected]) => {
    const a = comparable(actual) as never;
    const e = comparable(expected) as never;
    switch (op) {
      case 'equals':
        return a === e;
      case 'not':
        if (isPlainObject(expected)) return !matchField(actual, expected);
        // Giống SQL: `col <> 'x'` không bao giờ đúng với giá trị NULL (còn `not: null` nghĩa là IS NOT NULL)
        if (expected === null) return actual !== null && actual !== undefined;
        return actual !== null && actual !== undefined && a !== e;
      case 'in':
        return (expected as unknown[]).map(comparable).includes(a);
      case 'notIn':
        return !(expected as unknown[]).map(comparable).includes(a);
      case 'gt':
        return a > e;
      case 'gte':
        return a >= e;
      case 'lt':
        return a < e;
      case 'lte':
        return a <= e;
      case 'contains':
        return (
          typeof actual === 'string' && actual.includes(expected as string)
        );
      case 'mode':
        return true;
      default:
        throw new Error(`fake-table: unsupported operator "${op}"`);
    }
  });
}

export function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'AND')
      return ([] as Row[]).concat(cond as Row[]).every((w) => matches(row, w));
    if (key === 'OR') return (cond as Row[]).some((w) => matches(row, w));
    if (key === 'NOT')
      return !([] as Row[]).concat(cond as Row[]).some((w) => matches(row, w));
    // where kiểu unique ghép: { user_id_vocabulary_id: { user_id, vocabulary_id } }
    if (
      isPlainObject(cond) &&
      !(key in row) &&
      Object.keys(cond).every((k) => k in row)
    ) {
      return matches(row, cond);
    }
    return matchField(row[key], cond);
  });
}

interface FindArgs {
  where?: Row;
  orderBy?: Row | Row[];
  take?: number;
  skip?: number;
  select?: Row;
}

export class FakeTable<T extends Row> {
  rows: T[] = [];
  private nextId = 1n;

  constructor(private readonly idField: string | null = 'id') {}

  seed(...rows: T[]): this {
    for (const r of rows) {
      const withId =
        this.idField && r[this.idField] === undefined
          ? { ...r, [this.idField]: this.nextId }
          : r;
      this.rows.push(withId);
      if (this.idField) {
        const id = withId[this.idField];
        if (typeof id === 'bigint' && id >= this.nextId) this.nextId = id + 1n;
      }
    }
    return this;
  }

  private filter(args: FindArgs = {}): T[] {
    let out = this.rows.filter((r) => matches(r, args.where));
    const orders = ([] as Row[]).concat(args.orderBy ?? []);
    if (orders.length) {
      out = [...out].sort((a, b) => {
        for (const order of orders) {
          const [field, dir] = Object.entries(order)[0] as [
            string,
            'asc' | 'desc',
          ];
          const x = comparable(a[field]) as never;
          const y = comparable(b[field]) as never;
          if (x === y) continue;
          return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
        }
        return 0;
      });
    }
    const skip = args.skip ?? 0;
    return out.slice(
      skip,
      args.take === undefined ? undefined : skip + args.take,
    );
  }

  // Bản sao nông để test sửa dữ liệu trả về không làm hỏng bảng
  findMany = (args?: FindArgs) =>
    Promise.resolve(this.filter(args).map((r) => ({ ...r })));
  findFirst = (args?: FindArgs) =>
    Promise.resolve(this.filter(args)[0] ? { ...this.filter(args)[0] } : null);
  findUnique = (args: { where: Row }) => this.findFirst({ where: args.where });
  count = (args?: { where?: Row }) => Promise.resolve(this.filter(args).length);

  create = ({ data }: { data: Row }) => {
    const row = { ...data } as T;
    if (this.idField && row[this.idField] === undefined) {
      (row as Row)[this.idField] = this.nextId++;
    }
    this.rows.push(row);
    return Promise.resolve({ ...row });
  };

  createMany = ({ data }: { data: Row[] }) => {
    data.forEach((d) => void this.create({ data: d }));
    return Promise.resolve({ count: data.length });
  };

  update = ({ where, data }: { where: Row; data: Row }) => {
    const row = this.rows.find((r) => matches(r, where));
    if (!row)
      return Promise.reject(
        new Error('fake-table: record to update not found'),
      );
    Object.assign(row, data);
    return Promise.resolve({ ...row });
  };

  updateMany = ({ where, data }: { where?: Row; data: Row }) => {
    const hit = this.rows.filter((r) => matches(r, where));
    hit.forEach((r) => Object.assign(r, data));
    return Promise.resolve({ count: hit.length });
  };

  delete = ({ where }: { where: Row }) => {
    const i = this.rows.findIndex((r) => matches(r, where));
    if (i < 0)
      return Promise.reject(
        new Error('fake-table: record to delete not found'),
      );
    const [gone] = this.rows.splice(i, 1);
    return Promise.resolve({ ...gone });
  };

  deleteMany = ({ where }: { where?: Row } = {}) => {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, where));
    return Promise.resolve({ count: before - this.rows.length });
  };

  upsert = ({
    where,
    create,
    update,
  }: {
    where: Row;
    create: Row;
    update: Row;
  }) => {
    const row = this.rows.find((r) => matches(r, where));
    return row
      ? this.update({ where, data: update })
      : this.create({ data: create });
  };
}
