import { Module } from '@nestjs/common';
import { ListeningController } from './listening.controller';
import { ListeningService } from './listening.service';
import { PlayCounter } from './play-counter';

@Module({
  controllers: [ListeningController],
  providers: [ListeningService, PlayCounter],
})
export class ListeningModule {}
