import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AthleteLink } from './entities/athlete-link.entity';
import { AthletesService } from './services/athletes.service';
import { AthleteRosterController } from './controllers/athlete-roster.controller';
import { AthleteProgramsController } from './controllers/athlete-programs.controller';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';

// Domínio próprio pra AthleteLink (vínculo atleta<->programa, global,
// fora de qualquer evento) — importado por ProgramsModule (hook de
// sincronia quando o programa entra num evento novo) e AuthModule
// (setPassword). Não depende de ProgramsService/JudgesService de
// propósito, pra evitar import circular com ProgramsModule.
@Module({
  imports: [TypeOrmModule.forFeature([AthleteLink]), EventsModule, UsersModule],
  controllers: [AthleteRosterController, AthleteProgramsController],
  providers: [AthletesService],
  exports: [AthletesService],
})
export class AthletesModule {}
