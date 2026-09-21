import type { Request } from 'express';
import type { users } from '@prisma/client';

export type AuthRequest = Request & { user: users };

// Dạng user trả về cho frontend - KHÔNG bao giờ gửi password/token/API key thật ra ngoài
export interface PublicUser {
  id: number;
  name: string;
  email: string;
  locale: string | null;
  hasOwnGeminiKey: boolean;
}

export function toPublicUser(user: users): PublicUser {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    locale: user.locale,
    hasOwnGeminiKey: !!user.gemini_api_key,
  };
}
