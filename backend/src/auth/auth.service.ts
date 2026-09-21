import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Cùng chi phí băm với bản Laravel (BCRYPT_ROUNDS=12) - hash $2y$ của Laravel và $2b$ của bcryptjs
// đọc chéo được nên user cũ vẫn đăng nhập được.
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký.');
    }

    const now = new Date();
    const user = await this.prisma.users.create({
      data: {
        name: dto.name,
        email,
        password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        created_at: now,
        updated_at: now,
      },
    });
    return { user, token: await this.sign(user.id) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    // Cùng 1 thông báo cho "sai email" và "sai mật khẩu" để không lộ email nào đã đăng ký
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    return { user, token: await this.sign(user.id) };
  }

  private sign(userId: bigint): Promise<string> {
    return this.jwt.signAsync({ sub: Number(userId) });
  }
}
