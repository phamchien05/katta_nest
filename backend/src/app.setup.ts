import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

// Cấu hình chung cho app - dùng ở cả main.ts lẫn test e2e để hai bên không bao giờ lệch nhau.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // whitelist: bỏ mọi field client gửi thừa ngoài DTO (chống mass-assignment)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
