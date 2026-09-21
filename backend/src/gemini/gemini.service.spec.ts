import { ConfigService } from '@nestjs/config';
import { SecretBox } from '../common/secret-box';
import { GeminiService } from './gemini.service';

const APP_KEY = 'base64:' + Buffer.alloc(32, 'k').toString('base64');

function makeService(env: Record<string, string> = {}) {
  const config = {
    get: (k: string) => ({ APP_KEY, ...env })[k],
  } as unknown as ConfigService;
  const service = new GeminiService(config, new SecretBox(config));
  const sleeps: number[] = [];
  service.sleep = (ms) => {
    sleeps.push(ms);
    return Promise.resolve();
  };
  return { service, sleeps, secrets: new SecretBox(config) };
}

const ok = (payload: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    {
      status: 200,
    },
  );
const rateLimited = (retryDelay?: string) =>
  new Response(
    JSON.stringify({
      error: {
        details: retryDelay
          ? [
              {
                '@type': 'type.googleapis.com/google.rpc.RetryInfo',
                retryDelay,
              },
            ]
          : [],
      },
    }),
    { status: 429 },
  );

describe('GeminiService', () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('gọi đúng model/URL, gửi key qua header (không nằm trong URL) và trả JSON đã parse', async () => {
    fetchMock.mockResolvedValueOnce(ok({ score: 90 }));
    const { service } = makeService();

    const out = await service.generate('SECRET-KEY', 'prompt?', {
      type: 'OBJECT',
    });

    expect(out).toEqual({ score: 90 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect(url).not.toContain('SECRET-KEY');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'SECRET-KEY',
    );
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe('prompt?');
    expect(body.generationConfig).toEqual({
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
    });
  });

  it('dùng model tuỳ chọn', async () => {
    fetchMock.mockResolvedValueOnce(ok(['a']));
    await makeService().service.generateStringArray('k', 'p', {
      model: 'gemini-3.5-flash',
    });
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain(
      '/models/gemini-3.5-flash:generateContent',
    );
  });

  it('429: chờ đúng retryDelay Gemini trả về rồi thử lại, gọi onRetry', async () => {
    fetchMock
      .mockResolvedValueOnce(rateLimited('12.3s'))
      .mockResolvedValueOnce(ok(['x']));
    const { service, sleeps } = makeService();
    const retries: number[][] = [];

    const out = await service.generateStringArray('k', 'p', {
      onRetry: (d, a, m) => retries.push([d, a, m]),
    });

    expect(out).toEqual(['x']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([13_000]); // làm tròn lên
    expect(retries).toEqual([[12.3, 1, 3]]);
  });

  it('429 không có RetryInfo: chờ mặc định 8 giây', async () => {
    fetchMock
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(ok(['x']));
    const { service, sleeps } = makeService();
    await service.generateStringArray('k', 'p');
    expect(sleeps).toEqual([8_000]);
  });

  it('hết lượt thử vẫn 429 thì trả null (số lần gọi = maxRetries + 1)', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(rateLimited('1s')));
    const { service, sleeps } = makeService();
    expect(
      await service.generateStringArray('k', 'p', { maxRetries: 2 }),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });

  it('Gemini bắt chờ quá lâu (vd hết quota ngày) thì bỏ cuộc ngay, không giữ request', async () => {
    fetchMock.mockResolvedValueOnce(rateLimited('3600s'));
    const { service, sleeps } = makeService();
    expect(await service.generateStringArray('k', 'p')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('lỗi khác 429 (400/500) không thử lại', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const { service } = makeService();
    expect(await service.generateStringArray('k', 'p')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lỗi mạng / timeout / JSON hỏng trả null thay vì throw', async () => {
    const { service } = makeService();
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await service.generateStringArray('k', 'p')).toBeNull();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{not json' }] } }],
        }),
        { status: 200 },
      ),
    );
    expect(await service.generateStringArray('k', 'p')).toBeNull();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    );
    expect(await service.generateStringArray('k', 'p')).toBeNull();
  });

  describe('keyFor', () => {
    it('ưu tiên key riêng của user (giải mã), không có thì dùng key chung', () => {
      const { service, secrets } = makeService({ GEMINI_API_KEY: 'shared' });
      expect(service.keyFor({ gemini_api_key: secrets.encrypt('mine') })).toBe(
        'mine',
      );
      expect(service.keyFor({ gemini_api_key: null })).toBe('shared');
      expect(service.keyFor({ gemini_api_key: '' })).toBe('shared');
    });

    it('key riêng không giải mã được thì rơi về key chung; không có key nào thì null', () => {
      expect(
        makeService({ GEMINI_API_KEY: 'shared' }).service.keyFor({
          gemini_api_key: 'rac',
        }),
      ).toBe('shared');
      expect(makeService().service.keyFor({ gemini_api_key: null })).toBeNull();
    });
  });
});
