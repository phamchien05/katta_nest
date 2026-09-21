import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { users } from '@prisma/client';
import type { AuthRequest } from './auth.types';

// Lấy user đang đăng nhập trong controller: (@CurrentUser() user) - tương đương $request->user() / auth()->user()
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): users => {
    return ctx.switchToHttp().getRequest<AuthRequest>().user;
  },
);
