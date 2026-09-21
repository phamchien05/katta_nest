import { ConfigService } from '@nestjs/config';
import { SecretBox } from './secret-box';

// Dữ liệu mẫu sinh bằng chính Illuminate\Encryption\Encrypter của Laravel (aes-256-cbc, khoá 32 byte 'k')
const LARAVEL_KEY = 'base64:a2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2s=';
const LARAVEL_PAYLOAD =
  'eyJpdiI6Im0rWExTQ3VIQ3k4L3F6K2RRZURzZnc9PSIsInZhbHVlIjoidERxVkEyckorNGpGOVF0RkZLWnF6anJ3eEs0NVAzd25WaSsxbmNad3Q0WT0iLCJtYWMiOiJiMDcwNmQ5MDE0MjkzOGQzMDExNzY1MjhhOWFlZTU4MGIyMDJiOTAzM2IwNzRjOTEzY2RiNjFjNjc2YTcwNjdhIiwidGFnIjoiIn0=';
const LARAVEL_UNICODE_PAYLOAD =
  'eyJpdiI6Im1VUlk2OGJlOEVRVWlMTkFzK2U1cnc9PSIsInZhbHVlIjoidVFmWjZCK2pKSGhEelpJd1hkVzVjWkZFRVBoSk0wNUc2cjZyc3h6WUdTdz0iLCJtYWMiOiIzMThiODk1NzdjZTQxZGZjY2UxOTEwNDNlMDA4OWIyMDA3ODRlMTBkZGQwMzM1YWM3NjMxMDY2OGJiYTJmZDNiIiwidGFnIjoiIn0=';

const boxWith = (appKey?: string) =>
  new SecretBox({ get: () => appKey } as unknown as ConfigService);

describe('SecretBox', () => {
  it('giải mã được dữ liệu do Laravel mã hóa (kể cả tiếng Việt có dấu)', () => {
    const box = boxWith(LARAVEL_KEY);
    expect(box.decrypt(LARAVEL_PAYLOAD)).toBe('AIzaSy-test-key-123');
    expect(box.decrypt(LARAVEL_UNICODE_PAYLOAD)).toBe('khoá-tiếng-Việt');
  });

  it('mã hóa rồi giải mã ra đúng bản gốc; mỗi lần mã hóa ra chuỗi khác nhau (IV ngẫu nhiên)', () => {
    const box = boxWith(LARAVEL_KEY);
    const a = box.encrypt('secret-🔑');
    const b = box.encrypt('secret-🔑');
    expect(a).not.toBe(b);
    expect(a).not.toContain('secret');
    expect(box.decrypt(a)).toBe('secret-🔑');
  });

  it('bản mã hóa ra có đúng cấu trúc của Laravel (iv/value/mac/tag)', () => {
    const decoded: Record<string, string> = JSON.parse(
      Buffer.from(boxWith(LARAVEL_KEY).encrypt('x'), 'base64').toString(),
    );
    expect(Object.keys(decoded).sort()).toEqual(['iv', 'mac', 'tag', 'value']);
    expect(decoded.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('từ chối payload bị sửa, sai key hoặc rác - trả null thay vì throw', () => {
    const box = boxWith(LARAVEL_KEY);
    const json = JSON.parse(Buffer.from(LARAVEL_PAYLOAD, 'base64').toString());
    const tampered = Buffer.from(
      JSON.stringify({ ...json, value: json.value.replace(/.$/, 'A') }),
    ).toString('base64');

    expect(box.decrypt(tampered)).toBeNull();
    expect(box.decrypt('khong-phai-payload')).toBeNull();
    expect(box.decrypt('')).toBeNull();
    expect(
      boxWith('base64:' + Buffer.alloc(32, 'z').toString('base64')).decrypt(
        LARAVEL_PAYLOAD,
      ),
    ).toBeNull();
  });

  it('thiếu hoặc sai độ dài APP_KEY: không dùng được, không sập', () => {
    for (const bad of [undefined, '', 'base64:YWJj']) {
      const box = boxWith(bad);
      expect(box.available).toBe(false);
      expect(box.decrypt(LARAVEL_PAYLOAD)).toBeNull();
      expect(() => box.encrypt('x')).toThrow();
    }
  });
});
