import { Module } from '@nestjs/common';
import { FeedbackModule } from '../feedback/feedback.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [FeedbackModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
