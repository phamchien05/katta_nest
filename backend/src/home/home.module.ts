import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [StatsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
