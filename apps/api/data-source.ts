import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/users/entities/user.entity';
import { EmailVerification } from './src/auth/entities/email-verification.entity';
import { Event } from './src/events/entities/event.entity';
import { EventMember } from './src/events/entities/event-member.entity';
import { Category } from './src/categories/entities/category.entity';
import { Team } from './src/teams/entities/team.entity';
import { ScoringTemplate } from './src/scoring-templates/entities/scoring-template.entity';
import { ScoringCriterion } from './src/scoring-templates/entities/scoring-criterion.entity';
import { Regulation } from './src/regulations/entities/regulation.entity';
import { RegulationDocument } from './src/regulations/entities/regulation-document.entity';

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
    Team,
    ScoringTemplate,
    ScoringCriterion,
    Regulation,
    RegulationDocument,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
