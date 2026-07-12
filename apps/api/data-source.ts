import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/users/entities/user.entity';
import { EmailVerification } from './src/auth/entities/email-verification.entity';

config(); // carrega o .env

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, EmailVerification],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
