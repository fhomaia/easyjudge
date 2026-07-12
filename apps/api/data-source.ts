import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/users/entities/user.entity';
import { EmailVerification } from './src/auth/entities/email-verification.entity';
import { Event } from './src/events/entities/event.entity';
import { Category } from './src/categories/entities/category.entity';
import { Team } from './src/teams/entities/team.entity';

config(); // carrega o .env

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, EmailVerification, Event, Category, Team],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
