import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { users } from '@prisma/client';
import { SecretBox } from '../common/secret-box';

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

// Schema JSON kiểu Gemini (type viết HOA: OBJECT/ARRAY/STRING/INTEGER...)
export type GeminiSchema = Record<string, unknown>;

export interface GenerateOptions {
  model?: string;
  // Sinh 30-50 câu hỏi/lần (bộ đề Ngữ pháp) lâu hơn nhiều so với 5 câu (Đọc hiểu) nên nơi gọi có thể nới timeout
  timeoutMs?: number;
  maxRetries?: number;
  onRetry?: (delaySeconds: number, attempt: number, maxRetries: number) => void;
}

interface RawResponse {
  result: unknown;
  status: number;
  body: string;
}

// Gemini báo phải chờ lâu hơn mức này (thường là hết quota theo ngày) thì không đáng để giữ request chờ
const MAX_RETRY_WAIT_SECONDS = 60;
const DEFAULT_RETRY_WAIT_SECONDS = 8;

// Gọi Gemini API dùng chung cho toàn app: sinh nội dung (kho tự bù) và các tính năng AI thời gian thực
// (chấm điểm dịch, ...). Tự chờ rồi thử lại khi bị giới hạn tốc độ (429).
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  // Tách ra thành thuộc tính để test thay bằng hàm chờ tức thì
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  constructor(
    private readonly config: ConfigService,
    private readonly secrets: SecretBox,
  ) {}

  // Key dùng cho các request của user này: ưu tiên key riêng đã nhập ở Cài đặt, nếu chưa có thì dùng key chung của app
  keyFor(user: Pick<users, 'gemini_api_key'>): string | null {
    if (user.gemini_api_key) {
      const own = this.secrets.decrypt(user.gemini_api_key);
      if (own) return own;
      this.logger.warn(
        'Could not decrypt a per-user Gemini key (wrong APP_KEY?); falling back to the shared key.',
      );
    }
    return this.config.get<string>('GEMINI_API_KEY') || null;
  }

  // Ép trả về mảng chuỗi theo đúng thứ tự yêu cầu trong prompt
  generateStringArray(
    apiKey: string,
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<string[] | null> {
    return this.generate<string[]>(
      apiKey,
      prompt,
      { type: 'ARRAY', items: { type: 'STRING' } },
      options,
    );
  }

  // Trả về dữ liệu đã parse theo schema, hoặc null nếu lỗi/hết lượt thử
  async generate<T = unknown>(
    apiKey: string,
    prompt: string,
    schema: GeminiSchema,
    options: GenerateOptions = {},
  ): Promise<T | null> {
    const maxRetries = options.maxRetries ?? 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const { result, status, body } = await this.request(
        apiKey,
        prompt,
        schema,
        options,
      );
      if (result !== null && result !== undefined) return result as T;

      const delay =
        status === 429
          ? (this.parseRetryDelay(body) ?? DEFAULT_RETRY_WAIT_SECONDS)
          : null;
      if (
        delay === null ||
        attempt >= maxRetries ||
        delay > MAX_RETRY_WAIT_SECONDS
      ) {
        if (status !== 200)
          this.logger.warn(`Gemini request failed (status ${status}).`);
        return null;
      }

      options.onRetry?.(delay, attempt + 1, maxRetries);
      await this.sleep(Math.ceil(delay) * 1000);
    }
    return null;
  }

  // Chỉ gọi 1 lần: việc thử lại (chờ theo retryDelay Gemini trả về) do generate() lo, để không mất status thật (429)
  private async request(
    apiKey: string,
    prompt: string,
    schema: GeminiSchema,
    options: GenerateOptions,
  ): Promise<RawResponse> {
    const model = options.model ?? DEFAULT_MODEL;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          // Key gửi qua header (không nằm trong URL) để không bị lộ vào log/lỗi
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: schema,
            },
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
        },
      );
      const body = await response.text();
      if (!response.ok) return { result: null, status: response.status, body };

      const text = (
        JSON.parse(body) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        }
      ).candidates?.[0]?.content?.parts?.[0]?.text;
      return {
        result: text ? this.safeParse(text) : null,
        status: response.status,
        body,
      };
    } catch {
      return { result: null, status: 0, body: '' };
    }
  }

  private safeParse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private parseRetryDelay(body: string): number | null {
    try {
      const data = JSON.parse(body) as {
        error?: { details?: { '@type'?: string; retryDelay?: string }[] };
      };
      const info = data.error?.details?.find(
        (d) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
      );
      const seconds = info?.retryDelay ? parseFloat(info.retryDelay) : NaN;
      return Number.isFinite(seconds) ? seconds : null;
    } catch {
      return null;
    }
  }
}
