import { Global, Module } from '@nestjs/common';
import { SecretBox } from '../common/secret-box';
import { GeminiService } from './gemini.service';

@Global()
@Module({
  providers: [SecretBox, GeminiService],
  exports: [SecretBox, GeminiService],
})
export class GeminiModule {}
