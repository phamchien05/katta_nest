import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// Các cột id trong DB (Laravel) là BIGINT UNSIGNED -> Prisma trả về BigInt, mà JSON.stringify không
// serialize được BigInt. id của app này nhỏ hơn 2^53 nên chuyển thẳng sang number là an toàn.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
