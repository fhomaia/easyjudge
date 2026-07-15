import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JudgeParticipation } from './entities/judge-participation.entity';
import { JudgeProfile } from './entities/judge-profile.entity';
import { JudgesController } from './controllers/judges.controller';
import { JudgeProfileController } from './controllers/judge-profile.controller';
import { JudgeCatalogController } from './controllers/judge-catalog.controller';
import { JudgesService } from './services/judges.service';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JudgeParticipation, JudgeProfile]),
    EventsModule,
    UsersModule,
  ],
  controllers: [JudgesController, JudgeProfileController, JudgeCatalogController],
  providers: [JudgesService],
  exports: [JudgesService],
})
export class JudgesModule {}
