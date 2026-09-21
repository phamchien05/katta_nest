import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { FeedbackModule } from './feedback/feedback.module';
import { GeminiModule } from './gemini/gemini.module';
import { GrammarModule } from './grammar/grammar.module';
import { HealthController } from './health/health.controller';
import { HomeModule } from './home/home.module';
import { ListeningModule } from './listening/listening.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { ReadingModule } from './reading/reading.module';
import { StatisticsModule } from './statistics/statistics.module';
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
    GrammarModule,
    ListeningModule,
    ProgressModule,
    StatisticsModule,
    AccountModule,
    FeedbackModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
