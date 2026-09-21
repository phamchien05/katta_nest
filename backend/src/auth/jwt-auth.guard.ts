import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthRequest } from './auth.types';

export const AUTH_COOKIE = 'katta_token';

// Bảo vệ route bằng JWT lưu trong cookie httpOnly (JS trên trình duyệt không đọc được -> khó bị đánh cắp
// qua XSS). Tương đương middleware 'auth' của Laravel.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[
      AUTH_COOKIE
    ];
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<{ sub: number }>(token);
      const user = await this.prisma.users.findUnique({
        where: { id: BigInt(payload.sub) },
      });
      if (!user) throw new UnauthorizedException();
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
