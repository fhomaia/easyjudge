import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/users/entities/user.entity';
import { EmailVerification } from './src/auth/entities/email-verification.entity';
import { Event } from './src/events/entities/event.entity';
import { EventMember } from './src/events/entities/event-member.entity';
import { Category } from './src/categories/entities/category.entity';
import { ProgramParticipation } from './src/programs/entities/program-participation.entity';
import { ProgramProfile } from './src/programs/entities/program-profile.entity';
import { JudgeParticipation } from './src/judges/entities/judge-participation.entity';
import { JudgeProfile } from './src/judges/entities/judge-profile.entity';
import { Team } from './src/teams/entities/team.entity';
import { ScoringTemplate } from './src/scoring-templates/entities/scoring-template.entity';
import { ScoringCriterion } from './src/scoring-templates/entities/scoring-criterion.entity';
import { Regulation } from './src/regulations/entities/regulation.entity';
import { RegulationDocument } from './src/regulations/entities/regulation-document.entity';
import { CriterionJudgeAssignment } from './src/judging/entities/criterion-judge-assignment.entity';
import { SpecialRoleAssignment } from './src/judging/entities/special-role-assignment.entity';
import { ScheduleDay } from './src/schedule/entities/schedule-day.entity';
import { ScheduleResource } from './src/schedule/entities/schedule-resource.entity';
import { ScheduleEntry } from './src/schedule/entities/schedule-entry.entity';

config(); // carrega o .env

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    EmailVerification,
    Event,
    EventMember,
    Category,
    ProgramParticipation,
    ProgramProfile,
    JudgeParticipation,
    JudgeProfile,
    Team,
    ScoringTemplate,
    ScoringCriterion,
    Regulation,
    RegulationDocument,
    CriterionJudgeAssignment,
    SpecialRoleAssignment,
    ScheduleDay,
    ScheduleResource,
    ScheduleEntry,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
