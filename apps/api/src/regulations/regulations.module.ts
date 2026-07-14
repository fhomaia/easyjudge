import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Regulation } from './entities/regulation.entity';
import { RegulationDocument } from './entities/regulation-document.entity';
import { RegulationsController } from './controllers/regulations.controller';
import { RegulationsService } from './services/regulations.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Regulation, RegulationDocument]),
    EventsModule,
  ],
  controllers: [RegulationsController],
  providers: [RegulationsService],
})
export class RegulationsModule {}
