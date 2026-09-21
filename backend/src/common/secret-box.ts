import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

// Mã hóa/giải mã chuỗi bí mật (key Gemini riêng của user) theo ĐÚNG định dạng Crypt::encryptString của Laravel
// (AES-256-CBC + HMAC-SHA256, gói trong base64(JSON)) - nhờ vậy các key user đã lưu bên Laravel vẫn dùng được
// khi hai hệ thống dùng chung database, chỉ cần cùng APP_KEY ("base64:...").
@Injectable()
export class SecretBox {
  private readonly logger = new Logger(SecretBox.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('APP_KEY') ?? '';
    const decoded = raw.startsWith('base64:')
      ? Buffer.from(raw.slice(7), 'base64')
      : Buffer.from(raw);
    this.key = decoded.length === 32 ? decoded : null;
    if (!this.key) {
      this.logger.warn(
        'APP_KEY is missing or not 32 bytes: per-user Gemini keys cannot be stored or read.',
      );
    }
  }

  get available(): boolean {
    return this.key !== null;
  }

  encrypt(plain: string): string {
    const key = this.requireKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const value = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]).toString('base64');
    const ivB64 = iv.toString('base64');
    const mac = this.mac(key, ivB64, value);
    return Buffer.from(
      JSON.stringify({ iv: ivB64, value, mac, tag: '' }),
    ).toString('base64');
  }

  // Trả null nếu payload hỏng / sai key / bị sửa (không throw để một key lỗi không làm sập cả request)
  decrypt(payload: string): string | null {
    if (!this.key) return null;
    try {
      const json = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf8'),
      ) as {
        iv?: string;
        value?: string;
        mac?: string;
      };
      if (!json.iv || !json.value || !json.mac) return null;

      const expected = Buffer.from(this.mac(this.key, json.iv, json.value));
      const given = Buffer.from(json.mac);
      if (expected.length !== given.length || !timingSafeEqual(expected, given))
        return null;

      const decipher = createDecipheriv(
        'aes-256-cbc',
        this.key,
        Buffer.from(json.iv, 'base64'),
      );
      return Buffer.concat([
        decipher.update(Buffer.from(json.value, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }

  private mac(key: Buffer, ivB64: string, value: string): string {
    return createHmac('sha256', key)
      .update(ivB64 + value)
      .digest('hex');
  }

  private requireKey(): Buffer {
    if (!this.key) throw new Error('APP_KEY is not configured.');
    return this.key;
  }
}
