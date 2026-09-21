import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { GeminiModule } from './gemini/gemini.module';
import { HealthController } from './health/health.controller';
import { HomeModule } from './home/home.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReadingModule } from './reading/reading.module';
import { TranslateModule } from './translate/translate.module';
import { VocabularyModule } from './vocabulary/vocabulary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GeminiModule,
    AuthModule,
    VocabularyModule,
    HomeModule,
    TranslateModule,
    ReadingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
